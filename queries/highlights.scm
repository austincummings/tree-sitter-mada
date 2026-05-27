; Tree-sitter highlight queries for Mada.
; These are the canonical queries; the Zed extension copies them to its own
; languages/mada/highlights.scm (Zed does not read from the grammar package).

; -- Comments ----------------------------------------------------------------

(line_comment) @comment

; -- Declaration keywords ----------------------------------------------------

["fn" "spec" "const" "type" "struct" "enum" "interface" "impl" "axiom"
 "use" "let" "var"] @keyword

; -- Control flow ------------------------------------------------------------

["if" "else" "match" "while" "for" "loop" "return" "break" "in"]
  @keyword.control
(continue_expr) @keyword.control

; -- Proof / spec keywords ---------------------------------------------------

["requires" "ensures" "decreases" "by" "where"] @keyword.special

; -- Tactic keywords ---------------------------------------------------------

["intro" "apply" "exact" "have" "show" "cases" "induction" "simp"
 "linarith" "by_cases"] @keyword.special

(tactic_omega) @keyword.special
(tactic_trivial) @keyword.special
(tactic_rfl) @keyword.special
(tactic_assumption) @keyword.special
(tactic_constructor) @keyword.special
(tactic_left) @keyword.special
(tactic_right) @keyword.special
(tactic_todo) @variable.special

; -- Other keywords ----------------------------------------------------------

["as" "move" "with" "dyn" "extern" "mut"] @keyword

; -- Literals ----------------------------------------------------------------

(bool_literal) @boolean
(integer_literal) @number
(float_literal) @number
(string_literal) @string
(char_literal) @character

; -- Holes / todo ------------------------------------------------------------

(hole) @variable.special
(todo_kw) @variable.special
(wildcard_pattern) @variable.special

; -- Universes ---------------------------------------------------------------

(universe) @type.builtin

; -- Self --------------------------------------------------------------------

(self) @variable.special
(Self) @type

; -- Attributes --------------------------------------------------------------

(attribute) @attribute

; -- Query commands ----------------------------------------------------------

(query_command ["#check" "#eval" "#print" "#reduce"] @keyword.special)

; -- Function names ----------------------------------------------------------

(fn_decl name: (identifier) @function)
(spec_fn_decl name: (identifier) @function)
(axiom_decl name: (identifier) @function)
(call_expr function: (path (identifier) @function.call))
(method_call_expr method: (identifier) @function.method)

; -- Type names --------------------------------------------------------------

(struct_decl name: (identifier) @type.definition)
(enum_decl name: (identifier) @type.definition)
(spec_enum_decl name: (identifier) @type.definition)
(interface_decl name: (identifier) @type.definition)
(type_decl name: (identifier) @type.definition)
(assoc_type_decl name: (identifier) @type)
(impl_block type: (path (identifier) @type))
(impl_block trait: (path (identifier) @type))

; -- Constants ---------------------------------------------------------------

(const_decl name: (identifier) @constant)

; -- Enum variants -----------------------------------------------------------

(variant name: (identifier) @constructor)

; -- Struct fields -----------------------------------------------------------

(struct_field_item name: (identifier) @variable.member)
(variant_field name: (identifier) @variable.member)
(struct_field_init name: (identifier) @variable.member)

; -- Type / value parameters -------------------------------------------------

(bounded_param name: (identifier) @type.parameter)
(type_params (identifier) @type.parameter)
(param name: (identifier) @variable.parameter)
(closure_param name: (identifier) @variable.parameter)

; -- Lifetimes ---------------------------------------------------------------

(lifetime) @label
(lifetime_param name: (lifetime) @label)

; -- Variable bindings -------------------------------------------------------

(let_stmt pattern: (binding_pattern) @variable)
(var_stmt name: (identifier) @variable)

; -- Builtin types -----------------------------------------------------------

((identifier) @type.builtin
  (#match? @type.builtin
    "^(Nat|Int|Bool|Float|Char|String|Unit|Never|BitVec|Box|Vec|List|Option|Result|HashMap|HashSet|Alloc|IO|Panic|Effect|Lifetime|Universe|Seq|Prop)$"))

; -- Capitalized identifiers treated as types --------------------------------

((identifier) @type
  (#match? @type "^[A-Z]"))

; -- Operators ---------------------------------------------------------------

[":=" "=>" "->" "<->" ":" "::" "=" "==" "!=" "<" ">" "<=" ">="
 "+" "-" "*" "/" "%" "&" "|" "^" "<<" ">>" "&&" "||" "!" "?" ".." "..="]
  @operator

; -- Punctuation -------------------------------------------------------------

["(" ")" "[" "]" "{" "}"] @punctuation.bracket
["," ";" "."] @punctuation.delimiter
