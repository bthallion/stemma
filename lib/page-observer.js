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
            ValueAssignment    = observerNS.ValueAssignment,
            observeAssignments = this.observeAssignments.bind(this),
            handleMutations    = this.handleMutations.bind(this),
            targetWindow       = this.targetWindow      = window.top,
            // Assignments to a native object
            nativeAssignments  = this.nativeAssignments = [],
            // ordered DOM mutations
            mutationSequence   = this.mutationSequence  = [],
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
            nativeAssignments.push(assignmentRecord);
            this.setPropertyValue(targetWindow, key, value);
        });

        prototypes.forEach(prototype => {
            observeAssignments(prototype, (key, value) => {
                let assignmentRecord = new ValueAssignment(prototype, key, value);
                nativeAssignments.push(assignmentRecord);
                this.setPropertyValue(prototype, key, value);
            });
        });
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

        //console.log('setPropertyValue:', object);
        //console.log('property:', property);
        //console.log('value:', value);
        //console.log('\n');

        objectData[property] = value;
        dataMap.set(object, objectData); 
    }

    getPropertyValue(object, property) {
        let dataMap    = this.dataMap,
            objectData = dataMap.get(object);

        //console.log('getPropertyValue:', object);
        //console.log('property:', property);
        //console.log('\n');
        
        if (!objectData) {
            objectData = {};
            dataMap.set(object, objectData);
        }

        return objectData[property];
    }

    observeAssignments(object, setFn) {
        let that               = this,
            ValueAssignment    = observerNS.ValueAssignment,
            nativeAssignments  = this.nativeAssignments;
        Object.getOwnPropertyNames(object).filter(key => Boolean(key)).forEach(key => {
            let dataGetter         = that.getPropertyValue.bind(that, object, key),
                dataSetter         = setFn.bind(this, key),
                propertyDescriptor = Object.getOwnPropertyDescriptor(object, key),
                currentValue       = propertyDescriptor.value,
                isWritable         = propertyDescriptor.writable,
                isConfigurable     = propertyDescriptor.configurable,
                isDataField        = isWritable !== 'undefined';

            // undefined, NaN are examples of non-configurable global fields
            if (!isConfigurable) {
                return;
            }

            if (isDataField) {
                propertyDescriptor.get = dataGetter;
                propertyDescriptor.set = isWritable ? dataSetter : () => {
                    throw new Error('Writing to a read-only field!');
                };
                delete propertyDescriptor.writable;
                delete propertyDescriptor.value;
            }
            else if (propertyDescriptor.set) {
                propertyDescriptor.set = new Proxy(propertyDescriptor.set, {
                    apply(target, thisArg, args) {
                        const value = args[0];
                        nativeAssignments.push(new ValueAssignment(target, key, value));
                        target.apply(thisArg, args);
                    }
                });
            }

            // Don't let subsequent scripts reconfigure this property descriptor, otherwise we can't trust the log
            // Fortunately this doesn't fail silently, so its still a useful debugging clue
            propertyDescriptor.configurable = false;

            Object.defineProperty(object, key, propertyDescriptor);

            if (Object.isExtensible(currentValue)) {
                console.log('set proxy:', key);
                this.setPropertyValue(object, key, new Proxy(currentValue, {
                    set(target, property, value) {
                        console.log('set proxy:', key);
                        //console.log('setProperty:', target);
                        console.log('property:', property);
                        //console.log('value:', value);
                        let assignmentRecord = new ValueAssignment(target, key, value);
                        nativeAssignments.push(assignmentRecord);
                        target[property] = value;
                    },

                    get(target, property) {
                        console.log('property:', property);
                        if (typeof target[property] === 'function') {
                            return target[property].bind(target);
                        }
                        return target[property];
                    }
                }));
            }
            else if (isDataField) {
                this.setPropertyValue(object, key, currentValue);
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
window.observerNS = observerNS;