# stemma

This project is still in early development, but the basic idea is to create a log of changes to global objects during runtime.

Mutations to the DOM tree and assignments to native global fields and function prototype fields will be stored in separate sequential logs, with methods for filtering these mutations by selector, reference, field name, etc. exposed to the console.

DOM mutations are handled via MutationObserver hooks
Global field / prototype field assignments are hooked by defining each property on the parent object as an accessor field. Native data fields with primitive values are stored directly in a data map. Native data fields holding objects have that value wrapped with an ES6 proxy before storing it in the map. Native accessor fields have their `set` method wrapped with an ES6 proxy.

TODO: add stack traces to the assignment logs, so you can track down the offending script