import { Lexico } from './Lexico.js';

const textarea = document.getElementById('codigoFuente');
const btnAnalizar = document.getElementById('btnAnalizar');
const btnLimpiar = document.getElementById('btnLimpiar');
const btnImportar = document.getElementById('btnImportar');
const btnExportarTXT = document.getElementById('btnExportarTXT');
const btnExportarCSV = document.getElementById('btnExportarCSV');
const tablaTokensBody = document.querySelector('#tablaTokens tbody');
const mensajeEstado = document.getElementById('mensaje-estado');

let ultimoResultado = null;

//  BOTONES DE ACCIÓN 

btnAnalizar.addEventListener('click', () => {
    const codigo = textarea.value;
    limpiarResultados(); // Limpia la tabla y mensajes antes de analizar

    if (!codigo.trim()) {
        mostrarMensaje('info', 'ℹ️ El área de código está vacía.');
        return;
    }

    try {
        // Análisis Léxico
        const tokens = Lexico(codigo);
        ultimoResultado = tokens;

        mostrarTokens(tokens);
        if (tokens.length > 0) {
            mostrarMensaje('success', '✅ Análisis léxico completado exitosamente.');
        } else {
            mostrarMensaje('info', 'ℹ️ No se encontraron tokens en el código fuente.');
        }

    } catch (error) {
        ultimoResultado = { error };
        mostrarMensaje('error', `❌ Error: ${error.message}`);
    }
});

/**
 * Limpia el textarea, la tabla de resultados y los mensajes.
 */
btnLimpiar.addEventListener('click', () => {
    textarea.value = '';
    limpiarResultados();
    ultimoResultado = null;
});

/**
 * Abre un selector de archivos para importar un .txt al textarea.
 */
btnImportar.addEventListener('click', async () => {
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
        console.error('Error al importar archivo:', err);    }
});

/**
 * Exporta el contenido del textarea a un archivo .txt.
 */
btnExportarTXT.addEventListener('click', () => {
    const contenido = textarea.value;

    if (!contenido.trim()) {
        mostrarMensaje('info', 'ℹ️ No hay código para exportar.');
        return;
    }

    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Codigo_Fuente.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

/**
 * Exporta el contenido de la tabla a un archivo .csv.
 */
btnExportarCSV.addEventListener('click', () => {
    if (!ultimoResultado || !Array.isArray(ultimoResultado) || ultimoResultado.length === 0) {
        mostrarMensaje('info', 'ℹ️ No hay tokens para exportar.');
        return;
    }

    // Encabezados
    let csvContent = "Tipo,Valor,Posición,Fila,Columna\n";

    // Datos de cada token
    ultimoResultado.forEach(token => {
        csvContent += `${token.tipo},"${token.valor.replace(/"/g, '""')}",${token.posicion},${token.fila},${token.columna}\n`;
    });

    // Crear archivo y descargar
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Tokens.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    mostrarMensaje('success', '✅ Tokens exportados como CSV.');
});

// OTRAS FUNCIONES

/**
 * Inserta las filas de tokens en el cuerpo de la tabla.
 * @param {Array} tokens - El arreglo de objetos token.
 */
function mostrarTokens(tokens) {
    // Limpia solo el cuerpo de la tabla para no borrar las cabeceras
    tablaTokensBody.innerHTML = '';

    if (!tokens || tokens.length === 0) {
        return; // No hace nada si no hay tokens
    }

    const fragment = document.createDocumentFragment();
    tokens.forEach(token => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${token.tipo}</td>
            <td>${token.valor.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
            <td>${token.posicion}</td>
            <td>${token.fila}</td>
            <td>${token.columna}</td>
        `;
        fragment.appendChild(tr);
    });
    tablaTokensBody.appendChild(fragment);
}

/**
 * Muestra un mensaje en la barra de estado con un estilo específico.
 * @param {'success'|'error'|'info'} tipo - El tipo de mensaje.
 * @param {string} texto - El texto a mostrar.
 */
function mostrarMensaje(tipo, texto) {
    mensajeEstado.textContent = texto;
    mensajeEstado.className = ''; // Resetea clases
    mensajeEstado.classList.add(`mensaje-${tipo}`);
}

/**
 * Limpia la tabla de tokens y el mensaje de estado.
 */
function limpiarResultados() {
    tablaTokensBody.innerHTML = '';
    mensajeEstado.textContent = '';
    mensajeEstado.className = '';
}

const btnMostrarTodos = document.getElementById('btnMostrarTodos');
const btnSoloDesconocidos = document.getElementById('btnSoloDesconocidos');

// Botón: Mostrar todo
btnMostrarTodos.addEventListener('click', () => {
    if (ultimoResultado) {
        mostrarTokens(ultimoResultado);
        inputFiltro.value = "";
    }
});

// Botón: Mostrar solo desconocidos
btnSoloDesconocidos.addEventListener('click', () => {
    if (ultimoResultado) {
        const desconocidos = ultimoResultado.filter(t => t.tipo === "Desconocido");
        mostrarTokens(desconocidos);
        inputFiltro.value = "";
    }
});
