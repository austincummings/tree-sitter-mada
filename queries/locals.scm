; Locals queries for scope tracking and variable highlighting.
; Scopes let tree-sitter (and editors) know where names are introduced and used.

; ── Scopes ───────────────────────────────────────────────────────────────────

(source_file) @local.scope
(block) @local.scope
(fn_decl) @local.scope
(spec_fn_decl) @local.scope
(impl_block) @local.scope
(interface_decl) @local.scope
(match_arm) @local.scope
(if_expr) @local.scope
(if_let_expr) @local.scope
(while_expr) @local.scope
(while_let_expr) @local.scope
(for_expr) @local.scope
(loop_expr) @local.scope
(closure) @local.scope
(move_closure) @local.scope

; ── Definitions ──────────────────────────────────────────────────────────────

; Function name
(fn_decl name: (identifier) @local.definition)

; Spec function name
(spec_fn_decl name: (identifier) @local.definition)

; Struct / enum / interface / type names
(struct_decl name: (identifier) @local.definition)
(enum_decl name: (identifier) @local.definition)
(interface_decl name: (identifier) @local.definition)
(type_decl name: (identifier) @local.definition)
(const_decl name: (identifier) @local.definition)

; Type parameters
(type_params (identifier) @local.definition)
(bounded_param name: (identifier) @local.definition)

; Function parameters
(param name: (identifier) @local.definition)

; Closure parameters
(closure_param name: (identifier) @local.definition)

; let / var bindings
(let_stmt pattern: (binding_pattern) @local.definition)
(var_stmt name: (identifier) @local.definition)

; Pattern bindings (match arms, if let, while let, for)
(match_arm pattern: (binding_pattern) @local.definition)
(if_let_expr pattern: (binding_pattern) @local.definition)
(while_let_expr pattern: (binding_pattern) @local.definition)
(for_expr pattern: (binding_pattern) @local.definition)

; ── References ───────────────────────────────────────────────────────────────

(identifier) @local.reference
