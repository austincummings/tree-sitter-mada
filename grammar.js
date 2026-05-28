/**
 * Tree-sitter grammar for Mada.
 *
 * Mada is a dependently-typed language with Rust-familiar syntax.
 * Types and expressions are the same syntactic category (unified term language).
 */

const PREC = {
  IFF:        1,   // <->
  IMPLIES:    2,   // ->  (right-assoc, also function type)
  OR:         3,   // ||
  AND:        4,   // &&
  COMPARE:    5,   // = == != < > <= >=
  BITOR:      6,   // |
  BITXOR:     7,   // ^
  BITAND:     8,   // & (binary)
  SHIFT:      9,   // << >>
  ADD:       10,   // + -
  MUL:       11,   // * / %
  UNARY:     12,   // - !  (prefix)
  QUESTION:  13,   // ?    (postfix)
  CAST:      14,   // as
  RANGE:     15,   // .. ..=
  CALL:      16,   // f(x)  f[x]
  FIELD:     17,   // x.f  x.0
  METHOD:    18,   // x.f(args) — higher than field so method wins over field+call
};

module.exports = grammar({
  name: 'mada',

  extras: $ => [/\s+/, $.line_comment],

  word: $ => $.identifier,

  conflicts: $ => [
    // `Type` alone vs `Type[n]`
    [$.universe],
    // path: shift-reduce at every `::` (more segments vs stop here)
    [$.path],
    // `Name {` — the same token sequence is both a struct-literal name+body
    // and a path-expression; GLR explores both.
    [$._expr_no_arrow, $.struct_literal, $.struct_update],
    // `impl[A]` — is `A` a type_param or the start of a path expression?
    [$.path, $._type_param],
    // `(identifier)` — is it a closure param or a path expression?
    [$.path, $.closure_param],
    // `(self, ...)` in pi_type position vs `(self_expr, ...)` in tuple/paren.
    [$.self_param, $._expr_no_arrow],
    // `(x: T, ...)` — pi_type's param vs closure's closure_param.
    [$.param, $.closure_param],
    // `impl Trait + Trait` — is the second `+` extending the current impl_type?
    [$.impl_type],
    // `dyn Trait + Trait` — same issue for dyn_type
    [$.dyn_type],
    // `_` in closure param — hole or closure parameter wildcard?
    [$.hole, $.closure_param],
    // `for identifier as` — is identifier a binding_pattern or a path?
    [$.path, $.binding_pattern],
    // `decreases expr, impl` — is `,` continuing the decreases list or ending the clause?
    [$.spec_clause],
    // `where T: impl Trait, impl` — same comma ambiguity in where clauses
    [$.where_clause],
    // `by { }` — is `{}` a proof block or a tactic_block?
    [$.block, $.tactic_block],
    // `{ todo ; }` — is `todo` a tactic_todo or a todo_kw expression?
    [$.todo_kw, $.tactic_todo],
    // `{ inner_block }` — is the inner block-expr a statement (its value
    // discarded) or the outer block's final term (its value returned)?
    // GLR explores both; the longer/final-term parse wins in practice.
    [$._block_expr_no_semi, $._term],
  ],

  inline: $ => [
    $._literal,
    $._top_item,
    $._impl_member,
  ],

  rules: {

    // ───────────────────────────────────────────────────────────────────────
    // Source file
    // ───────────────────────────────────────────────────────────────────────

    source_file: $ => repeat($._top_item),

    _top_item: $ => choice(
      $.use_decl,
      $.fn_decl,
      $.spec_fn_decl,
      $.const_decl,
      $.type_decl,
      $.struct_decl,
      $.enum_decl,
      $.spec_enum_decl,
      $.interface_decl,
      $.impl_block,
      $.axiom_decl,
      $.query_command,
    ),

    // ───────────────────────────────────────────────────────────────────────
    // Comments
    // ───────────────────────────────────────────────────────────────────────

    line_comment: _ => token(seq('//', /[^\n]*/)),

    // ───────────────────────────────────────────────────────────────────────
    // Identifiers and keywords
    // ───────────────────────────────────────────────────────────────────────

    identifier: _ => /[a-zA-Z_][a-zA-Z0-9_]*/,

    // `self` and `Self` are special identifiers
    self: _ => 'self',
    Self: _ => 'Self',

    // Lifetime: apostrophe + identifier (Rust-style sigil).
    // Used at declaration sites (`['a]`), use sites (`&'a T`), and in
    // outlives bounds (`'a: 'b`). The leading `'` makes the lifetime
    // syntactically distinct from a borrow of a variable.
    lifetime: _ => token(seq("'", /[a-zA-Z_][a-zA-Z0-9_]*/)),

    // ───────────────────────────────────────────────────────────────────────
    // Literals
    // ───────────────────────────────────────────────────────────────────────

    _literal: $ => choice(
      $.typed_integer_literal,
      $.integer_literal,
      $.float_literal,
      $.string_literal,
      $.char_literal,
      $.bool_literal,
    ),

    integer_literal: _ => token(choice(
      /0x[0-9a-fA-F][0-9a-fA-F_]*/,
      /0b[01][01_]*/,
      /0o[0-7][0-7_]*/,
      /[0-9][0-9_]*/,
    )),

    // Typed integer literal: a bare integer immediately followed by a
    // type suffix. Kept as a separate rule (rather than extending
    // `integer_literal`'s token) so the bare integer's lexer state stays
    // identical to the pre-suffix grammar -- error recovery on unclosed
    // brackets etc. is sensitive to the lexer's state machine.
    typed_integer_literal: $ => seq(
      $.integer_literal,
      $.int_suffix,
    ),

    // Typed-integer suffix, attached without intervening whitespace via
    // `token.immediate`. Closed set: i8..isize, u8..usize, nat.
    int_suffix: _ => token.immediate(choice(
      'i8', 'i16', 'i32', 'i64', 'isize',
      'u8', 'u16', 'u32', 'u64', 'usize',
      'nat',
    )),

    float_literal: _ => token(
      /[0-9][0-9_]*\.[0-9][0-9_]*/,
    ),

    string_literal: _ => token(seq(
      '"',
      repeat(choice(/[^"\\]+/, /\\./)),
      '"',
    )),

    char_literal: _ => token(seq("'", choice(/[^'\\]/, /\\./), "'")),

    bool_literal: _ => choice('true', 'false'),

    // ───────────────────────────────────────────────────────────────────────
    // Attributes
    // ───────────────────────────────────────────────────────────────────────

    attribute: $ => seq(
      '#', '[',
      $.attr_body,
      ']',
    ),

    // Shared path rule used by attributes, use declarations, and expressions.
    // The shift-reduce conflict at `identifier • ::` is declared in `conflicts`.
    path: $ => seq(
      choice($.identifier, $.Self),
      repeat(seq('::', choice($.identifier, $.Self))),
    ),

    attr_body: $ => seq(
      field('name', $.path),
      optional(choice(
        seq('(', commaSep($.attr_arg), ')'),
        seq('=', field('value', $.attr_arg)),
      )),
    ),

    attr_arg: $ => choice(
      $.string_literal,
      $.integer_literal,
      $.identifier,
      seq($.identifier, '(', commaSep($.attr_arg), ')'),
    ),

    // ───────────────────────────────────────────────────────────────────────
    // Query commands  (#check, #eval, #print, #reduce)
    // ───────────────────────────────────────────────────────────────────────

    query_command: $ => seq(
      field('kind', choice('#check', '#eval', '#print', '#reduce')),
      field('body', $._expr),
      ';',
    ),

    // ───────────────────────────────────────────────────────────────────────
    // Use declarations
    // ───────────────────────────────────────────────────────────────────────

    use_decl: $ => seq(
      'use',
      field('path', $._use_tree),
      ';',
    ),

    _use_tree: $ => choice(
      $.use_glob,
      $.use_list,
      $.use_rename,
      $.use_path,
    ),

    use_glob:   $ => seq($.path, '::', '*'),
    use_list:   $ => seq(optional(seq($.path, '::')), '{', commaSep($._use_tree), '}'),
    use_rename: $ => seq($.path, 'as', $.identifier),
    use_path:   $ => $.path,

    // ───────────────────────────────────────────────────────────────────────
    // Type / universe parameters   [A: Type, u: Universe, ...]
    // ───────────────────────────────────────────────────────────────────────

    type_params: $ => seq(
      '[',
      commaSep1($._type_param),
      ']',
    ),

    _type_param: $ => choice(
      $.lifetime_param, // 'a  or  'a: 'b + 'c
      $.bounded_param,  // A: Bound + Bound
      $.identifier,     // A  (shorthand for A: Type)
    ),

    bounded_param: $ => seq(
      field('name', $.identifier),
      ':',
      field('bound', $._type_bound),
    ),

    // 'a   or   'a: 'b + 'c   (lifetime declaration with optional outlives bounds)
    lifetime_param: $ => seq(
      field('name', $.lifetime),
      optional(seq(
        ':',
        field('bound', $._lifetime_bound),
      )),
    ),

    _lifetime_bound: $ => seq(
      $.lifetime,
      repeat(seq('+', $.lifetime)),
    ),

    _type_bound: $ => seq(
      choice($._expr, $.lifetime),
      repeat(seq('+', choice($._expr, $.lifetime))),
    ),

    // ───────────────────────────────────────────────────────────────────────
    // Function parameters
    // ───────────────────────────────────────────────────────────────────────

    params: $ => commaSep1($.param),

    param: $ => choice(
      // Receiver shorthand: self, &self, &mut self (no explicit type)
      $.self_param,
      // Regular typed parameter:  name : Type   or   self : Type
      seq(
        field('name', choice($.identifier, $.self, '_')),
        ':',
        field('type', $._expr),
      ),
    ),

    // `self`, `&self`, `&'a self`, `&mut self`, or `&'a mut self` as a method receiver.
    self_param: $ => seq(
      optional(seq(
        '&',
        optional(field('lifetime', $.lifetime)),
        optional('mut'),
      )),
      $.self,
    ),

    // ───────────────────────────────────────────────────────────────────────
    // Spec clauses  (requires / ensures / decreases)
    // ───────────────────────────────────────────────────────────────────────

    spec_clause: $ => choice(
      seq('requires', field('condition', $._term)),
      seq('ensures', field('condition', $._term)),
      seq(
        'decreases',
        commaSep1(field('measure', $._term)),
        optional(seq('by', field('proof', $.block))),
      ),
    ),

    // ───────────────────────────────────────────────────────────────────────
    // Where clause
    // ───────────────────────────────────────────────────────────────────────

    where_clause: $ => seq(
      'where',
      commaSep1($.where_item),
    ),

    where_item: $ => choice(
      // Type bound:  T: Bound + Bound
      seq(
        field('type', $._expr),
        ':',
        field('bound', $._type_bound),
      ),
      // Lifetime outlives bound:  'a: 'b + 'c
      seq(
        field('lifetime', $.lifetime),
        ':',
        field('bound', $._lifetime_bound),
      ),
    ),

    // ───────────────────────────────────────────────────────────────────────
    // fn declaration
    // ───────────────────────────────────────────────────────────────────────

    fn_decl: $ => seq(
      repeat(field('attribute', $.attribute)),
      optional(seq('extern', optional(field('abi', $.string_literal)))),
      'fn',
      field('name', $.identifier),
      optional(field('type_params', $.type_params)),
      '(',
      optional(field('params', $.params)),
      ')',
      optional(seq('->', field('return_type', $._expr))),
      repeat(field('spec', $.spec_clause)),
      optional(field('where_clause', $.where_clause)),
      choice(
        ';',
        seq(':=', field('body', $._block_expr_no_semi)),
        seq(':=', field('body', $._inline_term), ';'),
      ),
    ),

    // ───────────────────────────────────────────────────────────────────────
    // spec fn declaration
    // ───────────────────────────────────────────────────────────────────────

    spec_fn_decl: $ => seq(
      repeat(field('attribute', $.attribute)),
      'spec',
      'fn',
      field('name', $.identifier),
      optional(field('type_params', $.type_params)),
      '(',
      optional(field('params', $.params)),
      ')',
      '->',
      field('return_type', $._expr),
      choice(
        ';',
        seq(':=', field('body', $._block_expr_no_semi)),
        seq(':=', field('body', $._inline_term), ';'),
      ),
    ),

    // ───────────────────────────────────────────────────────────────────────
    // const / type declarations
    // ───────────────────────────────────────────────────────────────────────

    const_decl: $ => seq(
      repeat(field('attribute', $.attribute)),
      'const',
      field('name', $.identifier),
      optional(seq(':', field('type', $._expr))),
      ':=',
      field('value', $._term),
      ';',
    ),

    type_decl: $ => seq(
      repeat(field('attribute', $.attribute)),
      'type',
      field('name', $.identifier),
      optional(field('type_params', $.type_params)),
      ':=',
      field('type', $._expr),
      ';',
    ),

    // ───────────────────────────────────────────────────────────────────────
    // axiom
    // ───────────────────────────────────────────────────────────────────────

    // Two surface forms:
    //   axiom Int : Type;                       -- typeless: opaque constant of a given type
    //   axiom nat_add(a: Nat, b: Nat) -> Nat;   -- function-shaped: parameters and return type
    // Both accept attributes (e.g. `#[builtin("nat_add")]` to bind stdlib
    // declarations into the compiler's BuiltinRegistry) and an optional
    // trailing `;` for consistency with other declaration forms.
    axiom_decl: $ => choice(
      seq(
        repeat(field('attribute', $.attribute)),
        'axiom',
        field('name', $.identifier),
        ':',
        field('type', $._expr),
        ';',
      ),
      seq(
        repeat(field('attribute', $.attribute)),
        'axiom',
        field('name', $.identifier),
        optional(field('type_params', $.type_params)),
        '(',
        optional(field('params', $.params)),
        ')',
        '->',
        field('type', $._expr),
        ';',
      ),
    ),

    // ───────────────────────────────────────────────────────────────────────
    // struct declaration
    // ───────────────────────────────────────────────────────────────────────

    struct_decl: $ => seq(
      repeat(field('attribute', $.attribute)),
      'struct',
      field('name', $.identifier),
      optional(field('type_params', $.type_params)),
      choice(
        // struct Foo { ... }    -- named, no trailing ;
        field('body', $.named_struct_body),
        // struct Foo { ... }    -- opaque stdlib, no trailing ;
        seq('{', '...', '}'),
        // struct Foo(A, B);     -- tuple, requires ;
        seq(field('body', $.tuple_struct_body), ';'),
        // struct Foo;           -- unit
        ';',
      ),
    ),

    named_struct_body: $ => seq(
      '{',
      repeat($.struct_field_item),
      '}',
    ),

    struct_field_item: $ => seq(
      choice(
        seq(
          repeat(field('attribute', $.attribute)),
          field('name', $.identifier),
          ':',
          field('type', $._expr),
        ),
        seq('where', field('invariant', $._expr)),
      ),
      optional(','),
    ),

    tuple_struct_body: $ => seq(
      '(', commaSep($._expr), ')',
    ),

    // ───────────────────────────────────────────────────────────────────────
    // enum declaration
    // ───────────────────────────────────────────────────────────────────────

    enum_decl: $ => seq(
      repeat(field('attribute', $.attribute)),
      'enum',
      field('name', $.identifier),
      optional(field('type_params', $.type_params)),
      optional(seq('(', field('index_params', $.params), ')')),
      optional(seq(':', field('kind', $._expr))),
      '{',
      commaSepTrailing(field('variant', $.variant)),
      '}',
    ),

    spec_enum_decl: $ => seq(
      repeat(field('attribute', $.attribute)),
      'spec', 'enum',
      field('name', $.identifier),
      optional(field('type_params', $.type_params)),
      optional(seq('(', field('index_params', $.params), ')')),
      optional(seq(':', field('kind', $._expr))),
      '{',
      commaSepTrailing(field('variant', $.variant)),
      '}',
    ),

    variant: $ => seq(
      repeat(field('attribute', $.attribute)),
      field('name', $.identifier),
      optional(choice(
        seq('(', commaSep(field('field_type', $._expr)), ')'),
        seq('{', commaSep($.variant_field), '}'),
      )),
      optional(seq(':', field('return_type', $._expr))),
    ),

    variant_field: $ => seq(
      repeat(field('attribute', $.attribute)),
      field('name', $.identifier),
      ':',
      field('type', $._expr),
    ),

    // ───────────────────────────────────────────────────────────────────────
    // interface declaration
    // ───────────────────────────────────────────────────────────────────────

    interface_decl: $ => seq(
      repeat(field('attribute', $.attribute)),
      'interface',
      field('name', $.identifier),
      optional(field('type_params', $.type_params)),
      optional(seq(':', field('superinterfaces', $._type_bound))),
      '{',
      repeat($._interface_member),
      '}',
    ),

    _interface_member: $ => choice(
      $.fn_decl,
      $.spec_fn_decl,
      $.assoc_type_decl,
    ),

    assoc_type_decl: $ => seq(
      'type',
      field('name', $.identifier),
      optional(seq(':', field('bound', $._type_bound))),
      optional(seq(':=', field('default', $._expr))),
      ';',
    ),

    // ───────────────────────────────────────────────────────────────────────
    // impl block
    // ───────────────────────────────────────────────────────────────────────

    impl_block: $ => seq(
      repeat(field('attribute', $.attribute)),
      'impl',
      optional(field('type_params', $.type_params)),
      choice(
        // Trait impl:  impl[A] Trait for Type
        seq(field('trait', $._expr), 'for', field('type', $._expr)),
        // Inherent impl:  impl[A] Type
        field('type', $._expr),
      ),
      optional(field('where_clause', $.where_clause)),
      '{',
      repeat($._impl_member),
      '}',
    ),

    _impl_member: $ => choice(
      $.fn_decl,
      $.spec_fn_decl,
      $.assoc_type_decl,
    ),

    // ───────────────────────────────────────────────────────────────────────
    // Statements (inside blocks)
    // ───────────────────────────────────────────────────────────────────────

    _stmt: $ => choice(
      $.let_stmt,
      $.let_else_stmt,
      $.var_stmt,
      $.assign_stmt,
      $.use_decl,
      $.query_command,
      $.expr_stmt,
    ),

    let_stmt: $ => seq(
      'let',
      field('pattern', $._pattern),
      optional(seq(':', field('type', $._expr))),
      ':=',
      field('value', $._term),
      ';',
    ),

    let_else_stmt: $ => seq(
      'let',
      field('pattern', $._pattern),
      ':=',
      field('value', $._term),
      'else',
      field('else_block', $.block),
      ';',
    ),

    var_stmt: $ => seq(
      'var',
      field('name', $.identifier),
      optional(seq(':', field('type', $._expr))),
      ':=',
      field('value', $._term),
      ';',
    ),

    assign_stmt: $ => seq(
      field('lhs', $._place_expr),
      ':=',
      field('rhs', $._term),
      ';',
    ),

    // Place expressions (left-hand sides of assignments)
    _place_expr: $ => choice(
      $.identifier,
      $.self,
      $.field_expr,
      $.index_expr,
      seq('*', $._place_expr),
    ),

    expr_stmt: $ => choice(
      seq($._inline_term, ';'),
      $._block_expr_no_semi,
    ),

    // Block expressions that don't need a trailing semicolon
    _block_expr_no_semi: $ => choice(
      $.block,
      $.if_expr,
      $.if_let_expr,
      $.match_expr,
      $.while_expr,
      $.while_let_expr,
      $.for_expr,
      $.loop_expr,
      $.by_block_tactic,
    ),

    // ───────────────────────────────────────────────────────────────────────
    // Blocks
    // ───────────────────────────────────────────────────────────────────────

    block: $ => seq(
      '{',
      repeat($._stmt),
      optional($._term),  // final expression without semicolon
      '}',
    ),

    // ───────────────────────────────────────────────────────────────────────
    // Terms (_term = anything usable as a top-level expression / body)
    // ───────────────────────────────────────────────────────────────────────

    _term: $ => choice(
      $.block,
      $.if_expr,
      $.if_let_expr,
      $.match_expr,
      $.while_expr,
      $.while_let_expr,
      $.for_expr,
      $.loop_expr,
      $.closure,
      $.move_closure,
      $.return_expr,
      $.break_expr,
      $.continue_expr,
      $.by_tactic,
      $.by_block_tactic,
      $.pi_type,
      $._expr,
    ),

    // _term minus the block-form expressions (those whose own closing `}`
    // already terminates them). Used in positions where a trailing `;` is
    // required, so the block forms are excluded to prevent a redundant
    // `};` after `fn f() := { ... }`.
    _inline_term: $ => choice(
      $.closure,
      $.move_closure,
      $.return_expr,
      $.break_expr,
      $.continue_expr,
      $.by_tactic,
      $.pi_type,
      $._expr,
    ),

    // ───────────────────────────────────────────────────────────────────────
    // Expressions
    // ───────────────────────────────────────────────────────────────────────

    _expr: $ => choice(
      prec.right(PREC.IMPLIES, seq(
        field('left', $._expr),
        field('op', choice('->', '<->')),
        field('right', $._expr),
      )),
      $._expr_no_arrow,
    ),

    _expr_no_arrow: $ => choice(
      $.binary_expr,
      $.unary_expr,
      $.question_expr,
      $.cast_expr,
      $.range_expr,
      $.call_expr,
      $.type_call_expr,
      $.method_call_expr,
      $.field_expr,
      $.index_expr,
      $.reference_expr,
      $.deref_expr,
      $.impl_type,
      $.dyn_type,
      // `path` covers bare identifiers AND qualified Foo::Bar paths.
      // struct_literal also uses `path` as its name prefix; that conflict
      // is declared below and resolved via GLR.
      $.path,
      $.tuple_expr,
      $.struct_literal,
      $.struct_update,
      $.paren_expr,
      $._literal,
      $.universe,
      $.hole,
      $.todo_kw,
      $.self,
      $.slice_type,
    ),

    // Binary expressions (left-associative by default)
    binary_expr: $ => {
      const ops = [
        [PREC.OR,      prec.left,  choice('||')],
        [PREC.AND,     prec.left,  choice('&&')],
        [PREC.COMPARE, prec.left,  choice('==', '!=', '<', '>', '<=', '>=', '=')],
        [PREC.BITOR,   prec.left,  choice('|')],
        [PREC.BITXOR,  prec.left,  choice('^')],
        [PREC.BITAND,  prec.left,  choice('&')],
        [PREC.SHIFT,   prec.left,  choice('<<', '>>')],
        [PREC.ADD,     prec.left,  choice('+', '-')],
        [PREC.MUL,     prec.left,  choice('*', '/', '%')],
      ];
      return choice(...ops.map(([prec_level, assoc, op]) =>
        assoc(prec_level, seq(
          field('left', $._expr_no_arrow),
          field('op', op),
          field('right', $._expr_no_arrow),
        ))
      ));
    },

    unary_expr: $ => prec(PREC.UNARY, seq(
      field('op', choice('-', '!')),
      field('operand', $._expr_no_arrow),
    )),

    question_expr: $ => prec(PREC.QUESTION, seq(
      field('operand', $._expr_no_arrow),
      '?',
    )),

    cast_expr: $ => prec.left(PREC.CAST, seq(
      field('value', $._expr_no_arrow),
      'as',
      field('type', $._expr_no_arrow),
    )),

    range_expr: $ => prec.left(PREC.RANGE, seq(
      optional(field('start', $._expr_no_arrow)),
      field('op', choice('..=', '..')),
      optional(field('end', $._expr_no_arrow)),
    )),

    // f(args)
    call_expr: $ => prec(PREC.CALL, seq(
      field('function', $._expr_no_arrow),
      '(',
      field('args', optional($.arg_list)),
      ')',
    )),

    // f[A, B]  -- type application or square-bracket indexing
    type_call_expr: $ => prec(PREC.CALL, seq(
      field('function', $._expr_no_arrow),
      '[',
      field('args', optional($.arg_list)),
      ']',
    )),

    // expr.method(args)
    method_call_expr: $ => prec(PREC.METHOD, seq(
      field('receiver', $._expr_no_arrow),
      '.',
      field('method', $.identifier),
      '(',
      field('args', optional($.arg_list)),
      ')',
    )),

    // expr.field or expr.0
    field_expr: $ => prec(PREC.FIELD, seq(
      field('value', $._expr_no_arrow),
      '.',
      field('field', choice($.identifier, $.integer_literal)),
    )),

    // expr[i]  (when not a type application — resolved by context)
    index_expr: $ => prec(PREC.CALL, seq(
      field('value', $._expr_no_arrow),
      '[',
      field('index', $._expr),
      ']',
    )),

    arg_list: $ => commaSep1($._term),

    // &T  &mut T  &'a T  &'a mut T
    //
    // Lifetimes carry the Rust-style `'` sigil, which keeps them
    // syntactically distinct from a borrow of a variable (`&x`).
    reference_expr: $ => prec(PREC.UNARY, seq(
      '&',
      optional(field('lifetime', $.lifetime)),
      optional('mut'),
      field('type', $._expr_no_arrow),
    )),

    // *expr
    deref_expr: $ => prec(PREC.UNARY, seq(
      '*',
      field('operand', $._expr_no_arrow),
    )),

    // impl Trait + Trait + 'a
    impl_type: $ => seq(
      'impl',
      choice($._expr_no_arrow, $.lifetime),
      repeat(seq('+', choice($._expr_no_arrow, $.lifetime))),
    ),

    // dyn Trait + Trait + 'a
    dyn_type: $ => seq(
      'dyn',
      choice($._expr_no_arrow, $.lifetime),
      repeat(seq('+', choice($._expr_no_arrow, $.lifetime))),
    ),

    // path covers both bare identifiers and qualified paths; both
    // expression paths and struct-literal name prefixes go through this rule.

    // (A, B) or (A,)  — tuples.  Single (x) is paren_expr.
    tuple_expr: $ => seq(
      '(',
      $._expr,
      ',',
      optional(seq(commaSep1($._expr), optional(','))),
      ')',
    ),

    // Name { field := val, ... }
    // Name must be a path (simple or qualified).  No arbitrary expressions —
    // that would conflict with every block-body construct.
    struct_literal: $ => seq(
      field('name', $.path),
      '{',
      commaSep($.struct_field_init),
      '}',
    ),

    struct_field_init: $ => seq(
      field('name', $.identifier),
      ':=',
      field('value', $._term),
    ),

    // Name { ..base, field := val }
    struct_update: $ => seq(
      field('name', $.path),
      '{',
      '..',
      field('base', $._expr),
      optional(','),
      optional(commaSep1($.struct_field_init)),
      '}',
    ),

    // (expr)  — grouping
    paren_expr: $ => seq('(', $._term, ')'),

    // Pi type with named parameters:  (x: Nat) -> P(x)
    //
    // The closure rule `(params) [-> ret] => body` shares the leading
    // `(params) ->` prefix; tree-sitter's GLR explores both and picks the
    // closure parse iff `=>` follows. Right-associative at IMPLIES so
    // `(x: A) -> B -> C` parses as `(x: A) -> (B -> C)`.
    pi_type: $ => prec.right(PREC.IMPLIES, seq(
      '(',
      optional(field('params', $.params)),
      ')',
      '->',
      field('return_type', $._expr),
    )),

    _paren_group: $ => seq(
      '(',
      $._expr,
      repeat(seq(',', $._expr)),
      ')',
    ),

    // [T]  — slice type (only meaningful after & or &mut)
    slice_type: $ => seq('[', $._expr, ']'),

    // Universe literals
    universe: $ => choice(
      'Prop',
      'Type',
      seq('Type', '[', $._ulevel, ']'),
      seq('Sort', '[', $._ulevel, ']'),
    ),

    _ulevel: $ => choice(
      $.integer_literal,
      $.identifier,
      seq($._ulevel, '+', $.integer_literal),
      seq('max', '(', $._ulevel, ',', $._ulevel, ')'),
      seq('imax', '(', $._ulevel, ',', $._ulevel, ')'),
    ),

    // Holes
    hole: _ => '_',
    todo_kw: _ => 'todo',

    // ───────────────────────────────────────────────────────────────────────
    // Control flow expressions
    // ───────────────────────────────────────────────────────────────────────

    if_expr: $ => prec.right(seq(
      'if',
      field('condition', $._expr),
      field('then', $.block),
      optional(seq(
        'else',
        field('else', choice($.block, $.if_expr, $.if_let_expr)),
      )),
    )),

    if_let_expr: $ => prec.right(seq(
      'if', 'let',
      field('pattern', $._pattern),
      ':=',
      field('value', $._expr),
      field('then', $.block),
      optional(seq(
        'else',
        field('else', choice($.block, $.if_expr, $.if_let_expr)),
      )),
    )),

    match_expr: $ => seq(
      'match',
      field('value', $._expr),
      '{',
      commaSepTrailing($.match_arm),
      '}',
    ),

    match_arm: $ => seq(
      field('pattern', $._pattern),
      '=>',
      field('body', $._term),
    ),

    while_expr: $ => seq(
      'while',
      field('condition', $._expr),
      optional(seq('decreases', commaSep1($._expr))),
      field('body', $.block),
    ),

    while_let_expr: $ => seq(
      'while', 'let',
      field('pattern', $._pattern),
      ':=',
      field('value', $._expr),
      optional(seq('decreases', commaSep1($._expr))),
      field('body', $.block),
    ),

    for_expr: $ => seq(
      'for',
      field('pattern', $._pattern),
      'in',
      field('iterable', $._expr),
      field('body', $.block),
    ),

    loop_expr: $ => seq(
      'loop',
      field('body', $.block),
    ),

    return_expr: $ => prec.right(-1, seq(
      'return',
      optional(field('value', $._expr)),
    )),

    break_expr: $ => prec.right(-1, seq(
      'break',
      optional(field('value', $._expr)),
    )),

    continue_expr: _ => 'continue',

    // ───────────────────────────────────────────────────────────────────────
    // Closures
    // ───────────────────────────────────────────────────────────────────────

    // (params) => body  or  (params) -> RetType => body
    closure: $ => seq(
      '(',
      field('params', optional($.closure_params)),
      ')',
      optional(seq('->', field('return_type', $._expr))),
      '=>',
      field('body', $._term),
    ),

    // move (params) => body
    move_closure: $ => seq(
      'move',
      '(',
      field('params', optional($.closure_params)),
      ')',
      optional(seq('->', field('return_type', $._expr))),
      '=>',
      field('body', $._term),
    ),

    closure_params: $ => commaSep1($.closure_param),

    closure_param: $ => choice(
      seq(
        field('name', choice($.identifier, '_')),
        ':',
        field('type', $._expr),
      ),
      field('name', choice($.identifier, '_')),
    ),

    // ───────────────────────────────────────────────────────────────────────
    // Tactic proofs
    // ───────────────────────────────────────────────────────────────────────

    // `by tactic` (inline form). Requires a trailing `;` at statement
    // position. tactic_block is NOT inside _tactic to avoid the
    // ambiguity between `by (tactic_block)` and `by (_tactic=tactic_block)`;
    // the block form `by { ... }` is `by_block_tactic` (a block-form
    // expression, like other block expressions it carries no trailing `;`).
    by_tactic: $ => seq(
      'by',
      field('tactic', $._tactic),
    ),

    // `by { tactic; ... }` (block form). Like other block-form
    // expressions (block, if_expr, match_expr, ...), it terminates
    // itself with the closing `}` and forbids a trailing `;` at
    // statement position.
    by_block_tactic: $ => seq(
      'by',
      field('tactic', $.tactic_block),
    ),

    tactic_block: $ => seq(
      '{',
      repeat(seq($._tactic, ';')),
      '}',
    ),

    _tactic: $ => choice(
      $.tactic_intro,
      $.tactic_apply,
      $.tactic_exact,
      $.tactic_have,
      $.tactic_show,
      $.tactic_cases,
      $.tactic_induction,
      $.tactic_simp,
      $.tactic_linarith,
      $.tactic_omega,
      $.tactic_trivial,
      $.tactic_rfl,
      $.tactic_assumption,
      $.tactic_constructor,
      $.tactic_left,
      $.tactic_right,
      $.tactic_by_cases,
      $.tactic_todo,
      // Note: tactic_block is not here; use `by { }` at the top level instead.
    ),

    tactic_intro: $ => seq('intro', repeat1($.identifier)),
    tactic_apply: $ => seq('apply', $._expr),
    tactic_exact: $ => seq('exact', $._expr),
    tactic_have: $ => seq(
      'have',
      $.identifier,
      optional(seq(':', $._expr)),
      ':=',
      $._term,
    ),
    tactic_show: $ => seq('show', $._expr),
    tactic_cases: $ => seq('cases', $.identifier, $.tactic_arm_block),
    tactic_induction: $ => seq('induction', $.identifier, $.tactic_arm_block),
    tactic_simp: $ => seq(
      'simp',
      optional(seq('[', commaSep($._expr), ']')),
    ),
    tactic_linarith: $ => seq(
      'linarith',
      optional(seq('[', commaSep($._expr), ']')),
    ),
    tactic_omega: _ => 'omega',
    tactic_trivial: _ => 'trivial',
    tactic_rfl: _ => 'rfl',
    tactic_assumption: _ => 'assumption',
    tactic_constructor: _ => 'constructor',
    tactic_left: _ => 'left',
    tactic_right: _ => 'right',
    tactic_by_cases: $ => seq(
      'by_cases',
      $.identifier,
      ':',
      $._expr,
      '{',
      'true', '=>', $._tactic, ',',
      'false', '=>', $._tactic,
      '}',
    ),
    tactic_todo: _ => 'todo',

    tactic_arm_block: $ => seq(
      '{',
      repeat($.tactic_arm),
      '}',
    ),

    tactic_arm: $ => seq(
      field('pattern', $._pattern),
      optional(seq('with', commaSep1($.identifier))),
      '=>',
      choice(
        seq($._tactic, ';'),
        $.tactic_block,
      ),
    ),

    // ───────────────────────────────────────────────────────────────────────
    // Patterns
    // ───────────────────────────────────────────────────────────────────────

    _pattern: $ => choice(
      $.wildcard_pattern,
      $.literal_pattern,
      $.binding_pattern,
      $.tuple_pattern,
      $.tuple_struct_pattern,
      $.struct_pattern,
      $.or_pattern,
      $.ref_pattern,
      $.path_pattern,
      $.nat_succ_pattern,
      $.as_pattern,
    ),

    wildcard_pattern: _ => '_',

    literal_pattern: $ => choice(
      $.integer_literal,
      $.float_literal,
      $.string_literal,
      $.char_literal,
      $.bool_literal,
    ),

    // Simple name binding
    binding_pattern: $ => $.identifier,

    // (p1, p2)
    tuple_pattern: $ => seq(
      '(', $._pattern, ',', optional(seq(commaSep1($._pattern), optional(','))), ')',
    ),

    // Constructor(p1, p2)
    tuple_struct_pattern: $ => seq(
      field('constructor', $._pattern_path),
      '(',
      commaSep($._pattern),
      ')',
    ),

    // Constructor { field: pat, ... }
    struct_pattern: $ => seq(
      field('constructor', $._pattern_path),
      '{',
      commaSep($.field_pattern),
      '}',
    ),

    field_pattern: $ => choice(
      seq(field('name', $.identifier), ':', field('pattern', $._pattern)),
      seq(field('name', $.identifier), 'as', field('binding', $.identifier)),
      field('name', $.identifier),
    ),

    // p1 | p2
    or_pattern: $ => prec.left(seq($._pattern, '|', $._pattern)),

    // &pat
    ref_pattern: $ => prec(2, seq('&', $._pattern)),

    // Constructor path in patterns: `Nil`, `Option::Some`, `List::Cons`.
    // Uses the shared `path` rule.
    _pattern_path: $ => $.path,
    path_pattern: $ => $.path,

    // k + 1 (nat successor pattern). Only the literal `1` is permitted —
    // the form binds the predecessor of a non-zero Nat. Other literals
    // (including `0`) are syntactically rejected.
    nat_succ_pattern: $ => seq(
      field('var', $.identifier),
      '+',
      field('n', alias(token('1'), $.integer_literal)),
    ),

    // pattern as name
    as_pattern: $ => prec(1, seq(
      field('pattern', $._pattern),
      'as',
      field('name', $.identifier),
    )),
  },
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function commaSep(rule) {
  return optional(commaSep1(rule));
}

function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)), optional(','));
}

function commaSepTrailing(rule) {
  return optional(seq(
    rule,
    repeat(seq(',', rule)),
    optional(','),
  ));
}
