export const TIPOS= {
    OPERADOR: "Operador",
    DELIMITADOR: "Delimitador",
    KEYWORD: "Keyword",
    ID: "Identificador",
    NUM: "Numero",
    STRING: "Cadena",
    COMENTARIO: "Comentario",   
    DESCONOCIDO: "Desconocido",
    EOF: "EOF"
};

export const OPERADORES = {
    ASIGNACION: ["="],
    LOGICO: ["||", "&&", "!"],
    IGUALDAD_REL_2C : ["==", "!=", "<=", ">="],
    IGUALDAD_REL_1C : [">", "<"],
    ARITMETICO: ["+", "-", "*", "/", "%"]
};

export const DELIMITADORES = ["(", ")", "{", "}", "[", "]", ";", ",", ".",":"];

export const KEYWORDS = [
    "class", "public", "true", "false", "private", "static",
    "void", "if", "else", "while", "int", "return", "bool"
];

export const REGEX = {
    ID: /^[a-zA-Z][a-zA-Z0-9]*$/,
    NUM: /^[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$/,
    STRING: /^"([^"]*)"$/,
    COMENTARIO: /^\/\/.*?\/\/$/
};