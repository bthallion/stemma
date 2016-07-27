# stemma

This project is still in early development, but the basic idea is to create a log of changes to global objects during runtime.

Mutations to the DOM tree and assignments to native global fields and function prototype fields will be stored in separate sequential logs, with methods for filtering these logs by selector, reference, field name, etc. exposed to the console.

-DOM mutations are handled via MutationObserver hooks

-Global field / prototype field assignments are hooked by defining each property on the parent object as an accessor field. Originally the idea was to wrap native extensible objects in ES6 proxies, but Chrome throws when you try to assign proxies to native fields. Hopefully that is fixed in the future.