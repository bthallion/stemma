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
observerNS.PageObserver = class PageObserver {

    constructor() {

        let ValueAssignment      = observerNS.ValueAssignment,
            observeAssignments   = this.observeAssignments.bind(this),
            handleMutations      = this.handleMutations.bind(this),
            windowAssignments    = this.windowAssignments    = [],
            prototypeAssignments = this.prototypeAssignments = [],
            mutationSequence     = this.mutationSequence     = [],
            dataMap              = this.dataMap              = new WeakMap(),
            mutationsMap         = this.mutationsMap         = new WeakMap(),
            mutationObserver     = this.mutationObserver     = new MutationObserver(handleMutations);

        const 
            prototypes = new Set(Object.getOwnPropertyNames(window).filter(key => {
                return window[key] && typeof window[key].prototype === 'object';
            }).map(key => {
                return window[key].prototype;
            }));

        observeAssignments(window, (key, value) => {
            let assignmentRecord = new ValueAssignment(window, key, value);
            windowAssignments.push(assignmentRecord);
            this.setPropertyValue(window, key, value);
        });

        prototypes.forEach(prototype => {
            observeAssignments(prototype, (key, value) => {
                let assignmentRecord = new ValueAssignment(prototype, key, value);
                prototypeAssignments.push(assignmentRecord);
                this.setPropertyValue(prototype, key, value);
            });
        });
    }

    handleMutations(mutations) {
        const 
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
                const nodeMutations = mutationsMap.get(node) || [];
                nodeMutations.push(mutation);
                mutationsMap.set(node, nodeMutations);
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
                value              = object[key],
                getter             = this.getPropertyValue.bind(this, object, key),
                setter             = setFn.bind(this, key),
                propertyDescriptor = Object.getOwnPropertyDescriptor(object, key),
                isConfigurable     = propertyDescriptor.configurable;

            // undefined is an example of an unconfigurable global field
            if (!isConfigurable) {
                return;
            }
            
            // Don't let subsequent scripts reconfigure this property descriptor, otherwise we can't trust the log
            // Fortunately this doesn't fail silently, so its still a useful debugging clue
            propertyDescriptor.configurable = false;
            propertyDescriptor.set          = setter;
            propertyDescriptor.get          = getter;
            // we're not allowed to set both accessor functions and value / writable statuses with defineProperty
            delete propertyDescriptor.value;
            delete propertyDescriptor.writable;

            Object.defineProperty(object, key, propertyDescriptor);
            object[key] = value;
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
}