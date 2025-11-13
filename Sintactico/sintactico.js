import { TIPOS } from "./Gramatica.js";

/**
 * Clase especial para Errores Sintácticos, incluye el token
 * donde ocurrió el error para reportarlo mejor.
 */
class ErrorSintactico extends Error {
    constructor(mensaje, token) {
        // Llama al constructor de la clase base (Error)
        super(mensaje);
        // Propiedades personalizadas
        this.token = token;
        this.name = "ErrorSintactico";
    }
}

/**
 * Implementa un Analizador de Descenso Recursivo
 * basado en la gramática LL(1) proporcionada.
 */
export class Parser {
    constructor(tokens) {
        // Filtramos comentarios. El parser no los necesita.
        this.tokens = tokens.filter(t => t.tipo !== TIPOS.COMENTARIO);
        this.posicion = 0;
    }

    /**
     * Inicia el análisis.
     * Es el punto de entrada (basado en el No-Terminal 'Program')
     */
    parse() {
        try {
            this.program();
            // Si llega aquí, todo salió bien
            return "Análisis Sintáctico Completado Exitosamente";
            
        } catch (error) {
            if (error instanceof ErrorSintactico) {
                // Relanzamos un error más claro para main.js
                const t = error.token;
                throw new Error(`[Fila ${t.fila}, Col ${t.columna}]: ${error.message} (Token: '${t.valor}', Tipo: ${t.tipo})`);
            }
            throw error; // Errores inesperados
        }
    }

    // --- MÉTODOS DE AYUDA (Helpers) ---

    /** Devuelve el token actual sin consumirlo */
    peek() {
        return this.tokens[this.posicion];
    }

    /** Devuelve true si estamos en el último token (EOF) */
    isAtEnd() {
        return this.peek().tipo === TIPOS.EOF;
    }

    /** Consume el token actual y avanza la posición */
    advance() {
        if (!this.isAtEnd()) this.posicion++;
        return this.previous();
    }

    /** Devuelve el token anterior (recién consumido) */
    previous() {
        return this.tokens[this.posicion - 1];
    }

    /** Comprueba si el token actual es del tipo esperado */
    check(tipo) {
        if (this.isAtEnd()) return false;
        return this.peek().tipo === tipo;
    }

    /**
     * Comprueba si el token actual coincide con alguno de los tipos.
     * Si coincide, consume el token y devuelve 'true'.
     * Si no, devuelve 'false'.
     */
    match(...tipos) {
        for (const tipo of tipos) {
            if (this.check(tipo)) {
                this.advance();
                return true;
            }
        }
        return false;
    }
    
    /**
     * Comprueba si el token actual es un Keyword específico.
     * Si lo es, lo consume y devuelve 'true'.
     */
    matchKeyword(valor) {
        if (this.check(TIPOS.KEYWORD) && this.peek().valor === valor) {
            this.advance();
            return true;
        }
        return false;
    }
    
    /**
     * Comprueba si el token actual es un Delimitador específico.
     * Si lo es, lo consume y devuelve 'true'.
     */
    matchDelimitador(valor) {
         if (this.check(TIPOS.DELIMITADOR) && this.peek().valor === valor) {
            this.advance();
            return true;
        }
        return false;
    }

    /**
     * Comprueba si el token actual es un Operador específico.
     * Si lo es, lo consume y devuelve 'true'.
     */
    matchOperador(valor) {
        if (this.check(TIPOS.OPERADOR) && this.peek().valor === valor) {
           this.advance();
           return true;
       }
       return false;
   }

    /**
     * Consume el token actual SI es del tipo esperado.
     * Si no, lanza un error sintáctico.
     */
    consume(tipo, mensajeError) {
        if (this.check(tipo)) return this.advance();
        throw this.error(this.peek(), mensajeError);
    }
    
    /**
     * Consume el token actual SI es un Delimitador específico.
     * Si no, lanza un error sintáctico.
     */
    consumeDelimitador(valor, mensajeError) {
        if (this.check(TIPOS.DELIMITADOR) && this.peek().valor === valor) {
            return this.advance();
        }
        throw this.error(this.peek(), mensajeError);
    }

    /** Genera un nuevo error sintáctico */
    error(token, mensaje) {
        return new ErrorSintactico(mensaje, token);
    }

    // --- REGLAS DE LA GRAMÁTICA (BASADAS EN LAS IMÁGENES) ---
    // Cada función corresponde a un No-Terminal

    // Program -> ClassList EOF
    program() {
        this.classList();
        this.consume(TIPOS.EOF, "Se esperaba el fin del archivo.");
    }

    // ClassList -> ClassDecl ClassList | ε
    classList() {
        // Si no empieza con 'class', es la regla épsilon (lista vacía)
        if (!this.matchKeyword('class')) {
            return; // Regla épsilon
        }
        
        // Si vemos 'class', consumimos la declaración y llamamos recursivamente
        this.posicion--; // Retrocedemos para que classDecl consuma 'class'
        this.classDecl();
        this.classList(); // Recursión
    }

    // ClassDecl -> class ID '{' MemberList '}'
    classDecl() {
        this.consume(TIPOS.KEYWORD, "Se esperaba 'class'."); // consume 'class'
        this.consume(TIPOS.ID, "Se esperaba un nombre (ID) para la clase.");
        this.consumeDelimitador('{', "Se esperaba '{' para iniciar el cuerpo de la clase.");
        this.memberList();
        this.consumeDelimitador('}', "Se esperaba '}' para cerrar el cuerpo de la clase.");
    }

    // MemberList -> Member MemberList | ε
    memberList() {
        // Si el token actual es '}', significa que MemberList es épsilon
        if (this.peek().valor === '}') {
            return; // Regla épsilon
        }

        // Si no, consumimos un 'Member' y llamamos recursivamente
        this.member();
        this.memberList();
    }

    // Member -> FieldDecl | MethodDecl
    member() {
        // --- LÓGICA DE LOOKAHEAD (Vistazo) ---
        // Necesitamos distinguir entre FieldDecl y MethodDecl
        // FieldDecl:  AccessOpt Type ID ArrOpt ';'
        // MethodDecl: AccessOpt StaticOpt RetType ID '(' ...
        
        // Guardamos la posición actual para poder "rebobinar"
        const snapshot = this.posicion;

        // Simulamos el parseo de las partes comunes/distintivas
        this.accessOpt();
        this.staticOpt();
        
        // RetType cubre Type (int, bool, ID) y 'void'
        this.retType(); 

        // Si lo que sigue no es un ID, es un error
        if (!this.check(TIPOS.ID)) {
             // Restauramos y lanzamos un error claro
             this.posicion = snapshot;
             throw this.error(this.peek(), "Se esperaba una declaración de campo (Field) o método (Method).");
        }
        this.advance(); // Consumimos el ID

        // ¡LA CLAVE! ¿Qué viene después del ID?
        const esMetodo = this.matchDelimitador('(');

        // Rebobinamos el parser a la posición inicial
        this.posicion = snapshot;

        // Ahora sí, llamamos a la regla correcta
        if (esMetodo) {
            this.methodDecl();
        } else {
            this.fieldDecl();
        }
    }

    // AccessOpt -> public | private | ε
    accessOpt() {
        if (this.matchKeyword('public') || this.matchKeyword('private')) {
            return; // Se consumió
        }
        // Si no, es épsilon (ε), no hacemos nada
    }
    
    // FieldDecl -> AccessOpt Type ID ArrOpt ';'
    fieldDecl() {
        this.accessOpt();
        this.type();
        this.consume(TIPOS.ID, "Se esperaba un ID para el campo.");
        this.arrOpt();
        this.consumeDelimitador(';', "Se esperaba ';' al final de la declaración de campo.");
    }
    
    // MethodDecl -> AccessOpt StaticOpt RetType ID '(' ParamListOpt ')' Block
    methodDecl() {
        this.accessOpt();
        this.staticOpt();
        this.retType();
        this.consume(TIPOS.ID, "Se esperaba un ID para el método.");
        this.consumeDelimitador('(', "Se esperaba '(' para la lista de parámetros.");
        this.paramListOpt();
        this.consumeDelimitador(')', "Se esperaba ')' para cerrar la lista de parámetros.");
        this.block();
    }

    // StaticOpt -> static | ε
    staticOpt() {
        if (this.matchKeyword('static')) {
            return; // Se consumió
        }
        // Si no, épsilon
    }

    // RetType -> Type | void
    retType() {
        if (this.matchKeyword('void')) {
            return; // Se consumió 'void'
        }
        this.type(); // Intenta parsear 'Type'
    }

    // ParamListOpt -> ParamList | ε
    paramListOpt() {
        // Si el siguiente token es ')', ParamList es épsilon
        if (this.peek().valor === ')') {
            return; // Regla épsilon
        }
        this.paramList();
    }

    // ParamList -> Param ParamListTail
    paramList() {
        this.param();
        this.paramListTail();
    }

    // ParamListTail -> ',' Param ParamListTail | ε
    paramListTail() {
        if (this.matchDelimitador(',')) {
            this.param();
            this.paramListTail();
        }
        // Si no, épsilon
    }

    // Param -> Type ID ArrOpt
    param() {
        this.type();
        this.consume(TIPOS.ID, "Se esperaba un ID para el parámetro.");
        this.arrOpt();
    }

    // Type -> int | bool | ID
    type() {
        if (this.matchKeyword('int') || this.matchKeyword('bool')) {
            return; // Se consumió tipo primitivo
        } else if (this.match(TIPOS.ID)) {
            return; // Se consumió tipo ID (ej. otra clase)
        }
        
        // Si no es ninguno, es un error
        throw this.error(this.peek(), "Se esperaba un tipo (int, bool, o ID).");
    }

    // ArrOpt -> '[' ']' ArrOpt | ε
    arrOpt() {
        if (this.matchDelimitador('[')) {
            this.consumeDelimitador(']', "Se esperaba ']' después de '[' en la declaración de arreglo.");
            this.arrOpt(); // Recursión para arreglos multidimensionales (ej. int[][])
        }
        // Si no, épsilon
    }

    // Block -> '{' StmtList '}'
    block() {
        this.consumeDelimitador('{', "Se esperaba '{' para iniciar un bloque.");
        this.stmtList();
        this.consumeDelimitador('}', "Se esperaba '}' para cerrar un bloque.");
    }

    // StmtList -> Stmt StmtList | ε
    stmtList() {
        // Si el siguiente token es '}', StmtList es épsilon
        if (this.peek().valor === '}') {
            return; // Regla épsilon
        }
        this.stmt();
        this.stmtList();
    }

    // Stmt -> Block | VarDecl | ExprStmt | IfStmt | WhileStmt | ReturnStmt
    stmt() {
        // Usamos el primer token para decidir qué regla seguir
        if (this.peek().valor === '{') {
            this.block();
        }
        else if (this.matchKeyword('if')) {
            this.posicion--; // Rebobinar para que ifStmt consuma 'if'
            this.ifStmt();
        }
        else if (this.matchKeyword('while')) {
            this.posicion--; // Rebobinar
            this.whileStmt();
        }
        else if (this.matchKeyword('return')) {
            this.posicion--; // Rebobinar
            this.returnStmt();
        }
        // Ambigüedad: VarDecl y ExprStmt pueden empezar con ID, int, bool.
        else if (this.check(TIPOS.KEYWORD) && (this.peek().valor === 'int' || this.peek().valor === 'bool')) {
            // Empieza con 'int' o 'bool', es VarDecl
            this.varDecl();
        }
        else if (this.check(TIPOS.ID)) {
            // --- LÓGICA DE LOOKAHEAD (Vistazo) ---
            // Puede ser VarDecl (ej. 'MiClase miVar;') o ExprStmt (ej. 'miVar = 5;')
            const snapshot = this.posicion;
            this.type(); // Consume 'ID' (como tipo)
            this.arrOpt();
            
            // Si después de 'Type' y 'ArrOpt' viene un 'ID', es VarDecl
            const esVarDecl = this.check(TIPOS.ID);
            
            this.posicion = snapshot; // Rebobinar

            if (esVarDecl) {
                this.varDecl();
            } else {
                this.exprStmt();
            }
        }
        // Si no es ninguno de los anteriores, debe ser una Expresión
        else {
            this.exprStmt();
        }
    }
    
    // VarDecl -> Type ID ArrOpt VarDeclTail
    varDecl() {
        this.type();
        this.consume(TIPOS.ID, "Se esperaba un ID para la variable.");
        this.arrOpt();
        this.varDeclTail();
    }

    // VarDeclTail -> '=' Expr ';' | ';'
    varDeclTail() {
        if (this.matchOperador('=')) {
            this.expr();
            this.consumeDelimitador(';', "Se esperaba ';' después de la inicialización de la variable.");
        } else {
            this.consumeDelimitador(';', "Se esperaba ';' al final de la declaración de variable.");
        }
    }

    // IfStmt -> if '(' Expr ')' Stmt ElseOpt
    ifStmt() {
        this.consume(TIPOS.KEYWORD, "Se esperaba 'if'.");
        this.consumeDelimitador('(', "Se esperaba '('.");
        this.expr();
        this.consumeDelimitador(')', "Se esperaba ')'.");
        this.stmt();
        this.elseOpt();
    }

    // ElseOpt -> else Stmt | ε
    elseOpt() {
        if (this.matchKeyword('else')) {
            this.stmt();
        }
        // Si no, épsilon
    }

    // WhileStmt -> while '(' Expr ')' Stmt
    whileStmt() {
        this.consume(TIPOS.KEYWORD, "Se esperaba 'while'.");
        this.consumeDelimitador('(', "Se esperaba '('.");
        this.expr();
        this.consumeDelimitador(')', "Se esperaba ')'.");
        this.stmt();
    }

    // ReturnStmt -> return Expr ';' | return ';'
    returnStmt() {
        this.consume(TIPOS.KEYWORD, "Se esperaba 'return'.");
        // Si lo que sigue no es ';', debe ser una Expr
        if (!this.check(TIPOS.DELIMITADOR) || this.peek().valor !== ';') {
            this.expr();
        }
        this.consumeDelimitador(';', "Se esperaba ';' al final del 'return'.");
    }

    // ExprStmt -> Expr ';' | ';'
    exprStmt() {
        // Si no es un ';', debe ser una Expr
        if (!this.check(TIPOS.DELIMITADOR) || this.peek().valor !== ';') {
            this.expr();
        }
        this.consumeDelimitador(';', "Se esperaba ';' al final de la expresión.");
    }

    // --- PARSER DE EXPRESIONES (Descenso Recursivo) ---
    // Sigue la precedencia de operadores

    // Expr -> Assign
    expr() {
        this.assign();
    }
    
    // Assign -> Or AssignTail
    assign() {
        this.or(); // Lado izquierdo
        this.assignTail(); // Lado derecho (recursivo)
    }

    // AssignTail -> '=' Assign | ε
    assignTail() {
        if (this.matchOperador('=')) {
            this.assign(); // Asignación es asociativa por la derecha
        }
        // Si no, épsilon
    }

    // Or -> And OrTail
    or() {
        this.and();
        this.orTail();
    }

    // OrTail -> '||' And OrTail | ε
    orTail() {
        if (this.matchOperador('||')) {
            this.and();
            this.orTail(); // Asociatividad por la izquierda (con recursión de cola)
        }
        // Si no, épsilon
    }

    // And -> Eq AndTail
    and() {
        this.eq();
        this.andTail();
    }

    // AndTail -> '&&' Eq AndTail | ε
    andTail() {
        if (this.matchOperador('&&')) {
            this.eq();
            this.andTail();
        }
        // Si no, épsilon
    }

    // Eq -> Rel EqTail
    eq() {
        this.rel();
        this.eqTail();
    }

    // EqTail -> '==' Rel EqTail | '!=' Rel EqTail | ε
    eqTail() {
        if (this.matchOperador('==') || this.matchOperador('!=')) {
            this.rel();
            this.eqTail();
        }
        // Si no, épsilon
    }

    // Rel -> Add RelTail
    rel() {
        this.add();
        this.relTail();
    }

    // RelTail -> '<' Add RelTail | '<=' Add RelTail | '>' Add RelTail | '>=' Add RelTail | ε
    relTail() {
        if (
            this.matchOperador('<') || this.matchOperador('<=') ||
            this.matchOperador('>') || this.matchOperador('>=')
        ) {
            this.add();
            this.relTail();
        }
        // Si no, épsilon
    }

    // Add -> Mul AddTail
    add() {
        this.mul();
        this.addTail();
    }

    // AddTail -> '+' Mul AddTail | '-' Mul AddTail | ε
    addTail() {
        if (this.matchOperador('+') || this.matchOperador('-')) {
            this.mul();
            this.addTail();
        }
        // Si no, épsilon
    }
    
    // Mul -> Unary MulTail
    mul() {
        this.unary();
        this.mulTail();
    }

    // MulTail -> '*' Unary MulTail | '/' Unary MulTail | '%' Unary MulTail | ε
    mulTail() {
        if (this.matchOperador('*') || this.matchOperador('/') || this.matchOperador('%')) {
            this.unary();
            this.mulTail();
        }
        // Si no, épsilon
    }

    // Unary -> '!' Unary | '-' Unary | Postfix
    unary() {
        if (this.matchOperador('!') || this.matchOperador('-')) {
            this.unary(); // Recursión para unarios (ej. !!true, --5)
        } else {
            this.postfix();
        }
    }

    // Postfix -> Primary PostfixTail
    postfix() {
        this.primary();
        this.postfixTail();
    }

    // PostfixTail -> '(' ArgListOpt ')' PostfixTail | '[' Expr ']' PostfixTail | '.' ID PostfixTail | ε
    postfixTail() {
        if (this.matchDelimitador('(')) {
            this.argListOpt();
            this.consumeDelimitador(')', "Se esperaba ')' para cerrar la lista de argumentos.");
            this.postfixTail(); // Permite llamadas encadenadas ej. foo(1)(2)
        }
        else if (this.matchDelimitador('[')) {
            this.expr();
            this.consumeDelimitador(']', "Se esperaba ']' para cerrar el acceso al arreglo.");
            this.postfixTail(); // Permite ej. arr[1][2]
        }
        else if (this.matchDelimitador('.')) {
            this.consume(TIPOS.ID, "Se esperaba un ID (nombre de campo o método) después de '.'.");
            this.postfixTail(); // Permite ej. obj.campo.metodo()
        }
        // Si no, épsilon
    }

    // Primary -> ID | NUM | STRING | true | false | '(' Expr ')'
    primary() {
        if (this.match(TIPOS.ID)) return;
        if (this.match(TIPOS.NUM)) return;
        if (this.match(TIPOS.STRING)) return;
        if (this.matchKeyword('true')) return;
        if (this.matchKeyword('false')) return;

        if (this.matchDelimitador('(')) {
            this.expr();
            this.consumeDelimitador(')', "Se esperaba ')' después de la expresión entre paréntesis.");
            return;
        }

        throw this.error(this.peek(), "Se esperaba un valor primario (ID, número, cadena, true, false, o '(').");
    }

    // ArgListOpt -> ArgList | ε
    argListOpt() {
        // Si el siguiente token es ')', ArgList es épsilon
        if (this.peek().valor === ')') {
            return; // Regla épsilon
        }
        this.argList();
    }

    // ArgList -> Expr ArgListTail
    argList() {
        this.expr();
        this.argListTail();
    }

    // ArgListTail -> ',' Expr ArgListTail | ε
    argListTail() {
        if (this.matchDelimitador(',')) {
            this.expr();
            this.argListTail();
        }
        // Si no, épsilon
    }
}