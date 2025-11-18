import { TIPOS } from "../Gramatica.js";

class ASTNode {
    constructor(type, value = null, children = []) {
        this.type = type;
        this.value = value;
        this.children = children;
    }
}

export class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.pos = 0;
        this.current = this.tokens[this.pos];
        this.skipIgnoredTokens(); // 1. SALTA COMENTARIOS AL INICIAR
    }

    // ---------------------
    // Nueva Utilidad
    // ---------------------
    skipIgnoredTokens() {
        // Asegura que this.current siempre apunte al siguiente token relevante
        while (this.current && this.current.tipo === TIPOS.COMENTARIO) {
            this.pos++;
            this.current = this.tokens[this.pos];
        }
    }

    // ---------------------
    // Utilidades básicas
    // ---------------------
    lookAhead(offset = 1) {
        // NOTA: lookAhead NO debe saltar tokens, solo mirar.
        if (this.pos + offset >= this.tokens.length) {
            return this.tokens[this.tokens.length - 1]; 
        }
        
        // El lookAhead actual no salta comentarios, lo cual es generalmente aceptable, 
        // ya que los comentarios deberían ser filtrados por skipIgnoredTokens.
        return this.tokens[this.pos + offset];
    }

    match(tipo, valor = null) {
        if (this.current.tipo === tipo && (valor === null || this.current.valor === valor)) {
            const matchedToken = this.current;
            this.pos++;
            this.current = this.tokens[this.pos];
            this.skipIgnoredTokens(); // 2. SALTA COMENTARIOS DESPUÉS DE MATCH
            return matchedToken;
        }

        throw new Error(`[Fila ${this.current.fila}, Col ${this.current.columna}]: Se esperaba '${valor ?? tipo}' y se encontró '${this.current.valor}'`);
    }

    matchOperator(op) {
        if (this.current.tipo === TIPOS.OPERADOR && this.current.valor === op) {
            this.pos++;
            this.current = this.tokens[this.pos];
            this.skipIgnoredTokens(); // 3. SALTA COMENTARIOS DESPUÉS DE MATCH OPERATOR
            return;
        }
        throw new Error(`[Fila ${this.current.fila}, Col ${this.current.columna}]: Se esperaba operador '${op}'`);
    }

    // ---------------------
    // REGLA PRINCIPAL
    // ---------------------
    parse() {
        const classes = [];
        // Program -> ClassList (ClassList -> ClassDecl ClassList | ε)
        while (this.current.tipo !== TIPOS.EOF) {
            classes.push(this.classDecl());
        }

        return new ASTNode("Program", null, classes);
    }

    // ---------------------
    // DECLARACIONES (cuerpo se mantiene sin cambios)
    // ---------------------

    classDecl() {
        this.match(TIPOS.KEYWORD, "class");
        const name = this.current.valor;
        this.match(TIPOS.ID);

        this.match(TIPOS.DELIMITADOR, "{");

        const body = this.classBody();

        this.match(TIPOS.DELIMITADOR, "}");

        return new ASTNode("ClassDecl", name, body);
    }

    classBody() {
        const members = [];

        // MemberList -> Member MemberList | ε
        while (!(this.current.tipo === TIPOS.DELIMITADOR && this.current.valor === "}")) {
            members.push(this.member());
        }

        return members;
    }

    // En sintactico.js, dentro de la clase Parser:

    member() {
        // Member -> Type ID ArrOpt? | Type ID (ParamList) Block
        const modifiers = [];

            while (
                this.current.tipo === TIPOS.KEYWORD &&
                ["public", "private", "static"].includes(this.current.valor)
            ) {
                modifiers.push(this.current.valor);
                this.match(TIPOS.KEYWORD); 
        }
        const type = this.type();
        
        // Si encontramos '[]' aquí, lo consumimos. Esto maneja la sintaxis 'Type[] ID'.
        let isArray = false;
        if (this.current.valor === "[" && this.lookAhead(1).valor === "]") {
            this.match(TIPOS.DELIMITADOR, "[");
            this.match(TIPOS.DELIMITADOR, "]");
            isArray = true;
        }

        const name = this.current.valor;
        this.match(TIPOS.ID); // Ahora sí, el siguiente debe ser el ID ('flags')

        // Si es un método?
        if (this.current.valor === "(") {
            // NOTA: No se permiten métodos que devuelvan Type[] en esta implementación simple, pero lo dejamos así.
            return this.methodDecl(type, name);
        }

        // Si es un arreglo FieldDecl -> Type ID ArrOpt ;
        // Si el arreglo no se definió en el tipo (Type ID[]), se busca la sintaxis ArrOpt aquí.
        if (this.current.valor === "[") {
            this.match(TIPOS.DELIMITADOR, "[");
            this.match(TIPOS.DELIMITADOR, "]");
            isArray = true;
        }
        
        // Si fue declarado como 'Type[] ID' (isArray=true) o 'Type ID[]' (pasó el segundo if), es un FieldDecl.
        // Si es un método (retorna arriba), entonces este es un FieldDecl.

        this.match(TIPOS.DELIMITADOR, ";");
        
        // Podrías registrar el tipo de campo como ArrayType o VarDecl[Array].
        const nodeType = isArray ? "ArrayFieldDecl" : "FieldDecl";
        return new ASTNode(nodeType, name, [type]);
    }

    methodDecl(type, name, modifiers = []) {
        this.match(TIPOS.DELIMITADOR, "(");
        const params = this.params();
        this.match(TIPOS.DELIMITADOR, ")");

        const block = this.block();

        return new ASTNode("MethodDecl", name, [type, ...modifiers, ...params, block]);
    }

    params() {
        const list = [];

        // ParamList -> Param ParamListTail | ε
        if (this.current.valor === ")") return list;

        list.push(this.param());

        // ParamListTail -> , Param ParamListTail | ε
        while (this.current.valor === ",") {
            this.match(TIPOS.DELIMITADOR, ",");
            list.push(this.param());
        }

        return list;
    }
    
    param() {
        // Param -> Type ID ArrOpt
        const t = this.type();
        const id = this.current.valor;
        this.match(TIPOS.ID);
        
        // ArrOpt -> [ ] | ε
        if (this.current.valor === "[") {
             this.match(TIPOS.DELIMITADOR, "[");
             this.match(TIPOS.DELIMITADOR, "]");
        }
        
        return new ASTNode("Param", id, [t]);
    }

    type() {
        const t = this.current.valor;

        if (["int", "bool", "void"].includes(t)) {
            this.match(TIPOS.KEYWORD);
            return new ASTNode("Type", t);
        }

        throw new Error(`[Fila ${this.current.fila}, Col ${this.current.columna}]: Tipo inválido '${t}'`);
    }

    // ---------------------
    // BLOQUES Y SENTENCIAS (cuerpo se mantiene sin cambios)
    // ---------------------
    block() {
        this.match(TIPOS.DELIMITADOR, "{");

        const stmts = [];
        // StmtList -> Stmt StmtList | ε
        while (!(this.current.tipo === TIPOS.DELIMITADOR && this.current.valor === "}")) {
            stmts.push(this.statement());
        }

        this.match(TIPOS.DELIMITADOR, "}");
        return new ASTNode("Block", null, stmts);
    }

    statement() {
        // Stmt -> Block
        if (this.current.valor === "{") return this.block();

        // Stmt -> if | while | return
        if (this.current.valor === "if") return this.ifStmt();
        if (this.current.valor === "while") return this.whileStmt();
        if (this.current.valor === "return") return this.returnStmt();
        
        // Stmt -> ; (Sentencia vacía)
        if (this.current.valor === ";") {
             this.match(TIPOS.DELIMITADOR, ";");
             return new ASTNode("EmptyStmt");
        }

        // Determinar si es una Declaración de variable local o una Expresión/Asignación
        if (["int", "bool"].includes(this.current.valor)) {
            // Stmt -> Type ID ArrOpt (= Expr)? ;
            const t = this.type();
            const name = this.current.valor;
            this.match(TIPOS.ID);
            
            // ArrOpt (aunque en sentencias locales ArrOpt no tiene mucho sentido sin inicialización,
            // lo dejamos para consistencia con FieldDecl si se permite)
            if (this.current.valor === "[") {
                this.match(TIPOS.DELIMITADOR, "[");
                this.match(TIPOS.DELIMITADOR, "]");
            }

            let expr = null;
            if (this.current.valor === "=") {
                this.matchOperator("=");
                expr = this.expr();
            }

            this.match(TIPOS.DELIMITADOR, ";");
            return new ASTNode("VarDeclLocal", name, expr ? [t, expr] : [t]);
        }

        // Stmt -> Expr ; (Puede ser Asignación o Llamada a método)
        const node = this.expr(); 
        
        // Si el resultado de la expresión es una Asignación o Llamada a Método (Expr;), consumimos el ';'
        this.match(TIPOS.DELIMITADOR, ";");
        return node;
    }

    assign(lvalue) {
        // Lógica de asignación (revisada para manejar el LValue como nodo)
        this.matchOperator("=");
        const expr = this.expr();
        return new ASTNode("Assign", null, [lvalue, expr]);
    }

    ifStmt() {
        this.match(TIPOS.KEYWORD, "if");
        this.match(TIPOS.DELIMITADOR, "(");
        const cond = this.expr();
        this.match(TIPOS.DELIMITADOR, ")");

        const thenStmt = this.statement();
        let elseStmt = null;

        if (this.current.valor === "else") {
            this.match(TIPOS.KEYWORD, "else");
            elseStmt = this.statement();
        }

        return new ASTNode("If", null, [cond, thenStmt, elseStmt].filter(n => n !== null));
    }

    whileStmt() {
        this.match(TIPOS.KEYWORD, "while");
        this.match(TIPOS.DELIMITADOR, "(");
        const cond = this.expr();
        this.match(TIPOS.DELIMITADOR, ")");

        const body = this.statement();

        return new ASTNode("While", null, [cond, body]);
    }

    returnStmt() {
        this.match(TIPOS.KEYWORD, "return");

        let exp = null;
        // ExprOpt -> Expr | ε
        if (this.current.valor !== ";") {
            exp = this.expr();
        }

        this.match(TIPOS.DELIMITADOR, ";");
        return new ASTNode("Return", null, exp ? [exp] : []);
    }

    // ---------------------
    // EXPRESIONES (cuerpo se mantiene sin cambios)
    // ---------------------
    expr() {
        // Usaremos esta función para manejar las asignaciones de forma explícita 
        // ya que el lado izquierdo de una asignación puede ser un Primary complejo (ej: arr[0])
        const left = this.logicOr();

        // Manejo de Asignación simple (solo si el Lado Izquierdo es un LValue válido)
        if (this.current.valor === "=") {
            if (left.type === "Identifier" || left.type === "ArrayAccess" || left.type === "MemberAccess") {
                return this.assign(left);
            }
            throw new Error(`[Fila ${this.current.fila}, Col ${this.current.columna}]: Lado izquierdo de la asignación no es válido.`);
        }
        
        return left;
    }

    // Lógica de precedencia (LogicoO/LogicoY/Equality/Relational/Add/Mul/Unary) - Sin cambios, ya es LL(1)
    logicOr() {
        let left = this.logicAnd();
        while (this.current.valor === "||") {
            this.matchOperator("||");
            const right = this.logicAnd();
            left = new ASTNode("Binary", "||", [left, right]);
        }
        return left;
    }

    logicAnd() {
        let left = this.equality();
        while (this.current.valor === "&&") {
            this.matchOperator("&&");
            const right = this.equality();
            left = new ASTNode("Binary", "&&", [left, right]);
        }
        return left;
    }

    equality() {
        let left = this.rel();
        while (["==", "!="].includes(this.current.valor)) {
            const op = this.current.valor;
            this.match(TIPOS.OPERADOR);
            const right = this.rel();
            left = new ASTNode("Binary", op, [left, right]);
        }
        return left;
    }

    rel() {
        let left = this.add();
        while (["<", ">", "<=", ">="].includes(this.current.valor)) {
            const op = this.current.valor;
            this.match(TIPOS.OPERADOR);
            const right = this.add();
            left = new ASTNode("Binary", op, [left, right]);
        }
        return left;
    }

    add() {
        let left = this.mul();
        while (["+", "-"].includes(this.current.valor)) {
            const op = this.current.valor;
            this.match(TIPOS.OPERADOR);
            const right = this.mul();
            left = new ASTNode("Binary", op, [left, right]);
        }
        return left;
    }

    mul() {
        let left = this.unary();
        while (["*", "/", "%"].includes(this.current.valor)) {
            const op = this.current.valor;
            this.match(TIPOS.OPERADOR);
            const right = this.unary();
            left = new ASTNode("Binary", op, [left, right]);
        }
        return left;
    }

    unary() {
        if (["!", "-"].includes(this.current.valor)) {
            const op = this.current.valor;
            this.match(TIPOS.OPERADOR);
            const expr = this.unary();
            return new ASTNode("Unary", op, [expr]);
        }
        return this.primary();
    }

    primary() {
        const token = this.current;
        let node;

        // Literales
        if (token.tipo === TIPOS.NUM) {
            this.match(TIPOS.NUM);
            node = new ASTNode("Number", token.valor);
        } else if (token.tipo === TIPOS.STRING) {
            this.match(TIPOS.STRING);
            node = new ASTNode("String", token.valor);
        } else if (token.tipo === TIPOS.KEYWORD && ["true", "false"].includes(token.valor)) {
            this.match(TIPOS.KEYWORD);
            node = new ASTNode("Boolean", token.valor);
        } else if (token.valor === "(") {
            this.match(TIPOS.DELIMITADOR, "(");
            node = this.expr();
            this.match(TIPOS.DELIMITADOR, ")");
        } else if (token.tipo === TIPOS.ID) {
            // Primario -> ID CallOpt AccessExprTail
            node = new ASTNode("Identifier", token.valor);
            this.match(TIPOS.ID);
            
            // CallOpt -> ( Args ) | ε
            if (this.current.valor === "(") {
                node = this.call(node); 
            }
            
            // AccessExprTail -> . ID AccessExprTail | [ Expr ] AccessExprTail | ε
            node = this.accessExprTail(node);
            
        } else {
            throw new Error(`[Fila ${token.fila}, Col ${token.columna}]: Expresión primaria no válida '${token.valor}'`);
        }
        
        return node;
    }
    
    // CallOpt -> ( Args ) | ε
    call(calleeNode) {
        this.match(TIPOS.DELIMITADOR, "(");
        const args = this.args(); 
        this.match(TIPOS.DELIMITADOR, ")");
        return new ASTNode("Call", null, [calleeNode, ...args]);
    }
    
    // Args -> Expr ArgListTail | ε
    args() {
        const list = [];
        if (this.current.valor === ")") return list; // Lista vacía
        
        list.push(this.expr());
        
        // ArgListTail -> , Expr ArgListTail | ε
        while (this.current.valor === ",") {
            this.match(TIPOS.DELIMITADOR, ",");
            list.push(this.expr());
        }
        
        return list;
    }
    
    // AccessExprTail -> . ID AccessExprTail | [ Expr ] AccessExprTail | ε
    accessExprTail(node) {
        let currentNode = node;
        while (this.current.valor === "." || this.current.valor === "[") {
            if (this.current.valor === ".") {
                // Acceso a miembro (Field Access)
                this.match(TIPOS.DELIMITADOR, ".");
                const member = this.current.valor;
                this.match(TIPOS.ID);
                currentNode = new ASTNode("MemberAccess", member, [currentNode]);
            } else if (this.current.valor === "[") {
                // Acceso a arreglo (Array Access)
                this.match(TIPOS.DELIMITADOR, "[");
                const index = this.expr();
                this.match(TIPOS.DELIMITADOR, "]");
                currentNode = new ASTNode("ArrayAccess", null, [currentNode, index]);
            }
        }
        return currentNode;
    }
}