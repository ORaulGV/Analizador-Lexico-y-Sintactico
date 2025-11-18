import { Lexico } from './Lexico/Lexico.js';
import { Parser } from './Sintactico/sintactico.js';
import { TIPOS } from "./Gramatica.js";

// --- ELEMENTOS DE LA INTERFAZ ---
const textarea = document.getElementById('codigoFuente');
const btnAnalizar = document.getElementById('btnAnalizar');
const btnLimpiar = document.getElementById('btnLimpiar');
const btnImportar = document.getElementById('btnImportar');
const btnExportarTXT = document.getElementById('btnExportarTXT');
const btnExportarCSV = document.getElementById('btnExportarCSV');
const btnMostrarTodos = document.getElementById('btnMostrarTodos');
const btnSoloDesconocidos = document.getElementById('btnSoloDesconocidos');

// Contenedores dinámicos
const mainTokensSection = document.querySelector('.tokens-section'); // Contenedor padre de resultados (Tokens)
const mensajeEstado = document.getElementById('mensaje-estado');

// ASUMIENDO que este es el nuevo div que creaste en tu HTML para el AST:
const astResultsContainer = document.getElementById('ast-results'); 

let ultimoResultadoTokens = null; // Almacena el array de tokens para filtrado/exportación

// --- FUNCIÓN DE VISUALIZACIÓN DEL AST ---

/**
 * Recorre y formatea el Árbol de Sintaxis Abstracta (AST) para su visualización.
 * @param {ASTNode} node - El nodo raíz del AST.
 * @param {number} indent - Nivel de indentación.
 * @returns {string} El AST formateado.
 */
function displayAST(node, indent = 0) {
    if (!node) return '';

    const indentation = '│  '.repeat(indent);
    let output = '';
    
    // Si es un nodo terminal (Identifier, Literal) o tiene valor
    const value = node.value ? `: ${node.value}` : '';

    output += `${indentation}├── <${node.type}>${value}\n`;

    // Recorre los hijos
    node.children.forEach(child => {
        output += displayAST(child, indent + 1);
    });
    
    return output;
}

// --- LÓGICA DE ANÁLISIS PRINCIPAL ---

btnAnalizar.addEventListener('click', () => {
    const codigo = textarea.value;
    
    if (!codigo.trim()) {
        mostrarMensaje('info', ' El área de código está vacía.');
        return;
    }
    
    limpiarResultados(true); // Limpia y restaura la tabla antes de analizar

    try {
        // 1. Análisis Léxico
        const tokens = Lexico(codigo);
        ultimoResultadoTokens = tokens;
        
        // A. Verificar errores LÉXICOS (Tokens DESCONOCIDOS)
        const tokensDesconocidos = tokens.filter(t => t.tipo === TIPOS.DESCONOCIDO);
        if (tokensDesconocidos.length > 0) {
            mostrarTokens(tokensDesconocidos); 
            mostrarMensaje('error', ` ERROR LÉXICO: Se encontraron ${tokensDesconocidos.length} tokens DESCONOCIDOS.`);
            return;
        }

        // 2. Análisis Sintáctico (LL(1) - Descenso Recursivo)
        const parser = new Parser(tokens);
        const astRoot = parser.parse(); // Obtiene la raíz del AST

        // 3. ÉXITO TOTAL
        mostrarMensaje('success', ' ÉXITO TOTAL: Código analizado. PASÓ ambos analizadores.');
        
        // CORRECCIÓN CLAVE: Mostrar tokens Y AST.
        mostrarTokens(ultimoResultadoTokens);
        mostrarAST(astRoot);

    } catch (error) {
        // Captura errores sintácticos o inesperados
        
        if (error.message.includes('Fila')) {
             // Error Sintáctico (formato [Fila X, Col Y]: ...)
             mostrarMensaje('error', ` ERROR SINTÁCTICO: ${error.message}`);
        } else {
             // Error Inesperado (ej: fallo al leer código, etc.)
             mostrarMensaje('error', ` Error Inesperado: ${error.message}`);
        }
        
        // Siempre mostramos la tabla de tokens para la depuración en caso de error
        mostrarTokens(ultimoResultadoTokens);
    }
});


// --- LÓGICA DE INTERFAZ Y UTILIDADES ---

/**
 * Muestra el AST formateado en el panel de resultados.
 * @param {ASTNode} astRoot - El nodo raíz del AST.
 */
function mostrarAST(astRoot) {
    const astContent = displayAST(astRoot);
    const astContainer = document.getElementById('ast-results');
    
    // Si el contenedor ya contiene el <pre>, solo actualizamos.
    // Si no, lo creamos.
    let preViewer = document.getElementById('ast-viewer');
    
    if (!preViewer) {
         // Recreamos la estructura interna necesaria
         astContainer.innerHTML = `
            <div class="table-container">
                <pre id="ast-viewer" class="ast-viewer"></pre>
            </div>
            <div class="button-actions">
                <button id="btnExportarASTTXT">Exportar AST (.txt)</button>
            </div>
        `;
        preViewer = document.getElementById('ast-viewer');
    }
    
    // 3. Insertar contenido del AST
    preViewer.textContent = astContent;
    
    // 4. Reasignar listener para exportar AST (si fue recreado)
    const exportButton = document.getElementById('btnExportarASTTXT');
    if (exportButton) {
        // Aseguramos que el listener se actualice correctamente
        exportButton.onclick = () => {
             exportarTexto(astContent, 'AST.txt', ' AST exportado como TXT.');
        };
    }
}

// Función auxiliar para exportar texto
function exportarTexto(contenido, nombreArchivo, mensajeExito) {
    if (!contenido.trim()) {
        mostrarMensaje('info', ' No hay contenido para exportar.');
        return;
    }
    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    mostrarMensaje('success', mensajeExito);
}


/**
 * Inserta las filas de tokens en el cuerpo de la tabla.
 * @param {Array} tokens - El arreglo de objetos token.
 */
function mostrarTokens(tokens) {
    // La lógica de mostrarTokens ahora solo manipula la tabla de tokens
    // y asume que la estructura de la tabla ya existe.
    const tablaTokensBody = document.querySelector('#tablaTokens tbody');
    if (!tablaTokensBody) {
        // Esto solo debería ocurrir si no se llama limpiarResultados(true) primero
        console.error("No se encontró el cuerpo de la tabla de tokens.");
        return;
    }
    
    tablaTokensBody.innerHTML = '';

    if (!tokens || tokens.length === 0) {
        return; 
    }

    const fragment = document.createDocumentFragment();
    tokens.forEach(token => {
        const tr = document.createElement('tr');
        // Sanitizamos el valor para evitar inyección XSS
        const valorSeguro = token.valor.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        tr.innerHTML = `
            <td>${token.tipo}</td>
            <td>${valorSeguro}</td>
            <td>${token.posicion}</td>
            <td>${token.fila}</td>
            <td>${token.columna}</td>
        `;
        // Si es desconocido, marcamos la fila
        if (token.tipo === TIPOS.DESCONOCIDO) {
            tr.classList.add('token-desconocido');
        }
        fragment.appendChild(tr);
    });
    tablaTokensBody.appendChild(fragment);
}


/**
 * Muestra un mensaje en la barra de estado con un estilo específico.
 */
function mostrarMensaje(tipo, texto) {
    mensajeEstado.textContent = texto;
    mensajeEstado.className = ''; 
    mensajeEstado.classList.add(`mensaje-${tipo}`);
}


/**
 * Limpia la tabla de tokens, el AST y el mensaje de estado.
 */
function limpiarResultados(restaurarEstructura = false) {
    if (restaurarEstructura) {
        // Recrea TODA la estructura de la tabla de tokens (la única sección dinámica que se toca)
        mainTokensSection.innerHTML = `
            <h2>Tokens</h2>
            <div class="table-container">
                <table id="tablaTokens">
                    <thead>
                        <tr>
                            <th>Tipo</th>
                            <th>Valor</th>
                            <th>Posición</th>
                            <th>Fila</th>
                            <th>Columna</th>
                        </tr>
                    </thead>
                    <tbody>
                    </tbody>
                </table>
            </div>
            <div class="filtro-tokens">
                <p>Filtrar Tokens:</p>
                <button id="btnMostrarTodos">Mostrar Todos</button>
                <button id="btnSoloDesconocidos">Desconocidos</button>
            </div>
            <div class="button-actions">
                <button id="btnImportar">Importar</button>
                <button id="btnExportarTXT">Exportar TXT</button>
                <button id="btnExportarCSV">Exportar CSV</button>
            </div>
        `;
        
        // Importante: Limpiar el contenedor del AST
        const astResultsContainer = document.getElementById('ast-results');
        if (astResultsContainer) {
             astResultsContainer.innerHTML = '';
        }

        // Reasignar listeners después de recrear el DOM de mainTokensSection
        document.getElementById('btnMostrarTodos').addEventListener('click', () => mostrarTokens(ultimoResultadoTokens));
        document.getElementById('btnSoloDesconocidos').addEventListener('click', () => {
            if (ultimoResultadoTokens) {
                const desconocidos = ultimoResultadoTokens.filter(t => t.tipo === TIPOS.DESCONOCIDO);
                mostrarTokens(desconocidos);
            }
        });
        document.getElementById('btnImportar').addEventListener('click', btnImportarHandler);
        // btnExportarTXT y btnExportarCSV se mantienen abajo
        
    } else {
        // Solo limpia el contenido sin restaurar la estructura
        const tablaTokensBody = document.querySelector('#tablaTokens tbody');
        if (tablaTokensBody) {
             tablaTokensBody.innerHTML = '';
        }
        if (astResultsContainer) {
             astResultsContainer.innerHTML = '';
        }
    }

    mensajeEstado.textContent = '';
    mensajeEstado.className = '';
}


// --- HANDLERS DE BOTONES DE ACCIÓN (Corregidos para usar función auxiliar) ---

btnLimpiar.addEventListener('click', () => {
    textarea.value = '';
    ultimoResultadoTokens = null;
    limpiarResultados(true);
});

const btnImportarHandler = async () => {
    try {
        const [fileHandle] = await window.showOpenFilePicker({
            types: [{
                description: 'Archivos de Texto',
                accept: { 'text/plain': ['.txt'] }
            }]
        });
        const file = await fileHandle.getFile();
        const text = await file.text();
        textarea.value = text;
        mostrarMensaje('info', '📄 Archivo importado correctamente.');
    } catch (err) {
        console.error('Error al importar archivo:', err); 
    }
};
btnImportar.addEventListener('click', btnImportarHandler);


const btnExportarTXTHandler = () => {
    exportarTexto(textarea.value, 'Codigo_Fuente.txt', '✅ Código fuente exportado como TXT.');
};
btnExportarTXT.addEventListener('click', btnExportarTXTHandler);


const btnExportarCSVHandler = () => {
    if (!ultimoResultadoTokens || !Array.isArray(ultimoResultadoTokens) || ultimoResultadoTokens.length === 0) {
        mostrarMensaje('info', 'ℹNo hay tokens para exportar.');
        return;
    }

    let csvContent = "Tipo,Valor,Posición,Fila,Columna\n";

    ultimoResultadoTokens.forEach(token => {
        // Escapar comillas dobles dentro del valor
        const valorCSV = token.valor.replace(/"/g, '""'); 
        csvContent += `${token.tipo},"${valorCSV}",${token.posicion},${token.fila},${token.columna}\n`;
    });

    exportarTexto(csvContent, 'Tokens.csv', '✅ Tokens exportados como CSV.');
};
btnExportarCSV.addEventListener('click', btnExportarCSVHandler);


// --- LÓGICA DE FILTRADO ---

// Botón: Mostrar todo
btnMostrarTodos.addEventListener('click', () => {
    if (ultimoResultadoTokens) {
        mostrarTokens(ultimoResultadoTokens);
    }
});

// Botón: Mostrar solo desconocidos
btnSoloDesconocidos.addEventListener('click', () => {
    if (ultimoResultadoTokens) {
        const desconocidos = ultimoResultadoTokens.filter(t => t.tipo === TIPOS.DESCONOCIDO);
        mostrarTokens(desconocidos);
    }
});