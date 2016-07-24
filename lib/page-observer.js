'use strict';

const observerNS = {};

observerNS.ValueAssignment = class ValueAssignment {
    constructor(object, property, newValue) {
        this.target       = object;
        this.type         = 'propertyAssignment';
        this.propertyName = property;
        this.oldValue     = object[property];
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
            ValueAssignment    = observerNS.ValueAssignment,
            observeAssignments = this.observeAssignments.bind(this),
            handleMutations    = this.handleMutations.bind(this),
            targetWindow       = this.targetWindow      = window.top,
            // Assignments that shadow a native global object field
            nativeOverrides    = this.nativeOverrides   = [],
            // Assignments to an accessor property, i.e. not an override
            nativeAssignments  = this.nativeAssignments = [],
            // ordered DOM mutations
            mutationSequence   = this.mutationSequence  = [],
            proxyMap           = this.proxyMap          = new Map(),
            dataMap            = this.dataMap           = new Map(),
            mutationsMap       = this.mutationsMap      = new WeakMap(),
            mutationObserver   = this.mutationObserver  = new MutationObserver(handleMutations);

        const
            prototypes = new Set(Object.getOwnPropertyNames(targetWindow).filter(key => {
                return typeof targetWindow[key] === 'function' && targetWindow[key].prototype;
            }).map(key => {
                return targetWindow[key].prototype;
            }));

        observeAssignments(targetWindow, (key, value) => {
            let assignmentRecord = new ValueAssignment(targetWindow, key, value);
            nativeOverrides.push(assignmentRecord);
            this.setPropertyValue(targetWindow, key, value);
        });

        prototypes.forEach(prototype => {
            observeAssignments(prototype, (key, value) => {
                let assignmentRecord = new ValueAssignment(prototype, key, value);
                nativeOverrides.push(assignmentRecord);
                this.setPropertyValue(prototype, key, value);
            });
        });
    }

    insertProxy(object, parent, field) {

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

    observeAssignments(object, setFn) {
        Object.getOwnPropertyNames(object).filter(key => Boolean(key)).forEach(key => {
            const
                currentValue       = object[key],
                noop               = () => {},
                ValueAssignment    = this.ValueAssignment,
                nativeAssignments  = this.nativeAssignments,
                dataGetter         = this.getPropertyValue.bind(this, object, key),
                dataSetter         = setFn.bind(this, key),
                propertyDescriptor = Object.getOwnPropertyDescriptor(object, key),
                isWritable         = propertyDescriptor.writable,
                isConfigurable     = propertyDescriptor.configurable,
                isDataField        = isWritable !== 'undefined';

            // undefined, NaN are examples of non-configurable global fields
            if (!isConfigurable) {
                return;
            }

            if (propertyDescriptor.set) {
                propertyDescriptor.set = new Proxy(propertyDescriptor.set, {
                    apply(target, thisArg, args) {
                        const value = args[0];
                        nativeAssignments.push(new ValueAssignment(target, key, value));
                        target.apply(thisArg, args);
                    }
                });
            }
            else if (isDataField) {
                propertyDescriptor.get = dataGetter;
                propertyDescriptor.set = isWritable ? dataSetter : () => {
                    throw new Error('Writing to a read-only field!');
                };
                delete propertyDescriptor.writable;
                delete propertyDescriptor.value;
            }

            // Don't let subsequent scripts reconfigure this property descriptor, otherwise we can't trust the log
            // Fortunately this doesn't fail silently, so its still a useful debugging clue
            propertyDescriptor.configurable = false;
            Object.defineProperty(object, key, propertyDescriptor);

            if (isWritable) {
                object[key] = currentValue;
            }
        });
    }

    // This method should take an array of selectors to include or exclude from the log
    // can also take element references to include or exclude
    getMutationSequence(opts) {

    }

    // Returns assignments to the window object
    getWindowAssignments() {

    }

    // Returns assignments to native prototypes
    getPrototypeAssignments() {

    }

    getSummary() {

    }
};

observerNS.pageObserver = new observerNS.PageObserver();