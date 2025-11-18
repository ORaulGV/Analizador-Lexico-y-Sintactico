import Token from "../Token.js";
import { TIPOS, OPERADORES, DELIMITADORES, KEYWORDS, REGEX } from "../Gramatica.js";

export function Lexico(codigoFuente) {
    let puntero = 0;
    let fila = 1;
    let columna = 1;
    const tokens = [];

    function avanzarCaracter() {
        if (codigoFuente[puntero] === '\n') {
            fila++;
            columna = 1;
        } else {
            columna++;
        }
        puntero++;
    }

    function eliminarEspacios() {
        while (puntero < codigoFuente.length && /\s/.test(codigoFuente[puntero])) {
            avanzarCaracter();
        }
    }

    function leerMientras(regex) {
        let startPuntero = puntero;
        let startColumna = columna;
        let startFila = fila;

        while (puntero < codigoFuente.length && regex.test(codigoFuente[puntero])) {
            avanzarCaracter();
        }
        
        return {
            lexema: codigoFuente.substring(startPuntero, puntero),
            fila: startFila,
            columna: startColumna
        };
    }

    while (puntero < codigoFuente.length) {
        eliminarEspacios();
        if (puntero >= codigoFuente.length) break;

        const inicioToken = puntero;
        const inicioFila = fila;
        const inicioColumna = columna;
        let leido = codigoFuente[puntero];

        // Strings
        if (leido === '"') {
            avanzarCaracter();
            let stringClosed = false;
            while (puntero < codigoFuente.length) {
                if (codigoFuente[puntero] === '"') {
                    stringClosed = true;
                    avanzarCaracter(); // incluir el cierre
                    break;
                }
                avanzarCaracter();
            }
            let lexema = codigoFuente.substring(inicioToken, puntero);
            // Mejorar la validación si se desea: REGEX.STRING es para cadenas completas
            if (stringClosed && REGEX.STRING.test(lexema)) {
                tokens.push(new Token(TIPOS.STRING, lexema, inicioToken, inicioFila, inicioColumna));
            } else {
                // Cadena no cerrada o mal formada
                tokens.push(new Token(TIPOS.DESCONOCIDO, lexema, inicioToken, inicioFila, inicioColumna));
            }
            continue;
        }

        // Comentarios (Corregido: hasta el final de línea)
        if (leido === '/' && puntero + 1 < codigoFuente.length && codigoFuente[puntero + 1] === '/') {
            const inicioTokenComentario = puntero;
            const inicioFilaComentario = fila;
            const inicioColumnaComentario = columna;
            
            // consume apertura '//'
            avanzarCaracter(); 
            avanzarCaracter(); 

            // avanzar hasta el final de la línea o EOF
            while (puntero < codigoFuente.length && codigoFuente[puntero] !== '\n') {
                avanzarCaracter();
            }

            const lexema = codigoFuente.substring(inicioTokenComentario, puntero);
            tokens.push(new Token(TIPOS.COMENTARIO, lexema, inicioTokenComentario, inicioFilaComentario, inicioColumnaComentario));

            continue; // Continuar al siguiente token después del comentario.
        }

        // Números
        if (/[0-9]/.test(leido)) {
            const { lexema, fila: numFila, columna: numColumna } = leerMientras(/[0-9eE.+-]/);
            if (REGEX.NUM.test(lexema)) {
                tokens.push(new Token(TIPOS.NUM, lexema, inicioToken, numFila, numColumna));
            } else {
                tokens.push(new Token(TIPOS.DESCONOCIDO, lexema, inicioToken, numFila, numColumna));
            }
            continue;
        }

        // Identificadores / Keywords
        if (/[a-zA-Z]/.test(leido)) {
            const { lexema, fila: idFila, columna: idColumna } = leerMientras(/[a-zA-Z0-9]/);
            if (KEYWORDS.includes(lexema)) {
                tokens.push(new Token(TIPOS.KEYWORD, lexema, inicioToken, idFila, idColumna));
            } else if (REGEX.ID.test(lexema)) {
                tokens.push(new Token(TIPOS.ID, lexema, inicioToken, idFila, idColumna));
            } else {
                tokens.push(new Token(TIPOS.DESCONOCIDO, lexema, inicioToken, idFila, idColumna));
            }
            continue;
        }

        // Operadores y delimitadores
        let dosCaracteres = codigoFuente.substring(puntero, puntero + 2);
        let unCaracter = codigoFuente.substring(puntero, puntero + 1);

        // Prioridad de 2 caracteres
        if (
            [...OPERADORES.LOGICO, ...OPERADORES.IGUALDAD_REL_2C].includes(dosCaracteres)
        ) {
            tokens.push(new Token(TIPOS.OPERADOR, dosCaracteres, inicioToken, inicioFila, inicioColumna));
            avanzarCaracter();
            avanzarCaracter();
            continue;
        }

        // 1 caracter: Operadores y el delimitador de un caracter
        if (
            [...OPERADORES.ASIGNACION, ...OPERADORES.ARITMETICO, ...OPERADORES.IGUALDAD_REL_1C, "!"].includes(
                unCaracter
            )
        ) {
            tokens.push(new Token(TIPOS.OPERADOR, unCaracter, inicioToken, inicioFila, inicioColumna));
            avanzarCaracter();
            continue;
        }

        if (DELIMITADORES.includes(unCaracter)) {
            tokens.push(new Token(TIPOS.DELIMITADOR, unCaracter, inicioToken, inicioFila, inicioColumna));
            avanzarCaracter();
            continue;
        }
        
        // Si no encaja en nada = desconocido
        tokens.push(new Token(TIPOS.DESCONOCIDO, leido, inicioToken, inicioFila, inicioColumna));
        avanzarCaracter();
    }
    // Añadir token EOF al final
    tokens.push(new Token(TIPOS.EOF, "EOF", puntero, fila, columna));
    return tokens;
}