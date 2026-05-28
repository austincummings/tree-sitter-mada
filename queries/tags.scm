; Tags queries for code navigation / ctags-style indexing.

(fn_decl
  name: (identifier) @name) @definition.function

(spec_fn_decl
  name: (identifier) @name) @definition.function

(struct_decl
  name: (identifier) @name) @definition.class

(enum_decl
  name: (identifier) @name) @definition.class

(interface_decl
  name: (identifier) @name) @definition.interface

(const_decl
  name: (identifier) @name) @definition.constant

(type_decl
  name: (identifier) @name) @definition.type

(variant
  name: (identifier) @name) @definition.constructor

(call_expr
  function: (path (identifier) @name)) @reference.call

(method_call_expr
  method: (identifier) @name) @reference.call
