'use strict';

const observerNS = {};

observerNS.ValueAssignment = class ValueAssignment {
    constructor(object, property, newValue) {
        this.target       = object;
        this.type         = 'propertyAssignment';
        this.propertyName = property;
        this.newValue     = newValue;
        this.currentTime  = performance.now();
    }
};

observerNS.stringifyNode = function stringifyNode(node) {
    switch (node.nodeType) {
        case Node.ELEMENT_NODE:
            return node.outerHTML.split(node.innerHTML).join('');
        case Node.TEXT_NODE:
            return 'textNode: "' + node.data + '"';
        default:
            return 'default: ' + node;
    }
};

// TODO: we should also check if fields on the document object are overwritten
// window.__proto__ and window.__proto__.__proto__ (WindowProperties) needs to be observed
// set window __proto__ fields to proxy trapping sets, triggers set accessor when the field is undefined on the window
observerNS.PageObserver = class PageObserver {

    constructor() {

        const
            ValueAssignment      = observerNS.ValueAssignment,
            observeNativeGlobals = this.observeNativeGlobals.bind(this),
            handleMutations      = this.handleMutations.bind(this),
            // Assignments to a native object
            nativeAssignments    = this.nativeAssignments = [],
            // ordered DOM mutations
            mutationSequence     = this.mutationSequence  = [],
            dataMap              = this.dataMap           = new Map(),
            mutationMap          = this.mutationMap       = new WeakMap(),
            mutationObserver     = this.mutationObserver  = new MutationObserver(handleMutations);

        observeNativeGlobals();
    }

    handleMutations(mutations) {
        const
            mutationMap      = this.mutationMap,
            mutationSequence = this.mutationSequence,
            handlerTime      = performance.now();
        let 
            sequenceIndex    = mutationSequence.length;
        
        mutations.forEach(mutation => {
            const 
                target       = mutation.target,
                removedNodes = mutation.removedNodes,
                addedNodes   = mutation.addedNodes;

            mutation.sequenceIndex = sequenceIndex;
            sequenceIndex += 1;

            function addNodeMutation(node) {
                const nodeMutations = mutationMap.get(node) || [];
                nodeMutations.push(mutation);
                mutationMap.set(node, nodeMutations);
            }

            addNodeMutation(target);
            removedNodes.forEach(addNodeMutation.bind(this));
            addedNodes.forEach(addNodeMutation.bind(this));
            mutationSequence.push(mutation.bind(this));
        });
    }

    setPropertyValue(object, property, value) {
        let dataMap    = this.dataMap,
            objectData = dataMap.get(object) || {};

        objectData[property] = value;
        dataMap.set(object, objectData); 
    }

    getPropertyValue(object, property) {
        let dataMap    = this.dataMap,
            objectData = dataMap.get(object);
        
        if (!objectData) {
            objectData = {};
            dataMap.set(object, objectData);
        }

        return objectData[property];
    }

    observeNativeGlobals() {
        const
            ValueAssignment   = observerNS.ValueAssignment,
            nativeAssignments = this.nativeAssignments,
            getPropertyValue  = this.getPropertyValue.bind(this),
            setPropertyValue  = this.setPropertyValue.bind(this),
            objectsToObserve  = [window.top],
            observedObjects   = new Map();

        // Define each configurable property as an accessor field, so that we can run handlers when the field is accessed.
        // Iteratively observe each nested function and object in this manner
        function observeObject(object) {
            if (observedObjects.get(object)) {
                // We're already observing this element
                return;
            }

            observedObjects.set(object, true);

            const properties = Object.getOwnPropertyNames(object).filter(key => Boolean(key));

            properties.forEach(property => {
                let getter, setter, objectString,
                    currentValue, valueType;
                const
                    propertyDescriptor = Object.getOwnPropertyDescriptor(object, property),
                    isWritable         = propertyDescriptor.writable,
                    isConfigurable     = propertyDescriptor.configurable,
                    isDataField        = isWritable !== undefined;

                if (isDataField) {
                    currentValue = object[property];
                    valueType    = typeof currentValue;
                }

                // If this property value is extensible, observe it
                if (currentValue && valueType === 'object' || valueType === 'function') {
                    objectsToObserve.push(currentValue);
                }

                // undefined, NaN are examples of non-configurable global fields
                if (!isConfigurable || property === 'toString') {
                    return;
                }

                try {
                    objectString = object.toString();
                }
                catch (e) {
                    // Some constructors require that their methods be called on an instance of the object
                    objectString = 'Object throws on toString';
                }

                if (isDataField) {
                    getter = () => {
                        return getPropertyValue(object, property);
                    };
                    setter = isWritable ? (value) => {
                        console.log(`set object: ${objectString}, property: ${property}, value: ${value}`);
                        nativeAssignments.push(new ValueAssignment(object, property, value));
                        setPropertyValue(object, property, value);
                    } : () => { throw new Error('Assigned to a read-only field!'); };
                    setPropertyValue(object, property, currentValue);
                }
                // Native accessor field
                else {
                    let nativeGet = propertyDescriptor.get,
                        nativeSet = propertyDescriptor.set;
                    getter = nativeGet ? () => {
                        return nativeGet.call(object);
                    } : nativeGet;
                    setter = nativeSet ? (value) => {
                        console.log(`set object: ${objectString}, property: ${property}, value: ${value}`);
                        nativeAssignments.push(new ValueAssignment(object, property, value));
                        nativeSet.call(object, value);
                    } : nativeSet;
                }

                delete propertyDescriptor.writable;
                delete propertyDescriptor.value;
                propertyDescriptor.set = setter;
                propertyDescriptor.get = getter;
                // Don't let subsequent scripts reconfigure this property descriptor, otherwise we can't trust the log
                // Fortunately this doesn't fail silently, so its still a useful debugging clue
                propertyDescriptor.configurable = false;

                console.log(`define property object: ${objectString}, property: ${property}`);
                Object.defineProperty(object, property, propertyDescriptor);
            });
        }

        while (objectsToObserve.length) {
            observeObject(objectsToObserve.shift());
        }
    }

    // This method should take an array of selectors to include or exclude from the log
    // can also take element references to include or exclude
    getMutationSequence(opts) {

    }

    // Returns assignments to natively defined properties of global objects
    getNativeAssignments() {
        return this.nativeAssignments;
    }

    getSummary() {

    }
};

observerNS.pageObserver = new observerNS.PageObserver();
window.observerNS = observerNS;