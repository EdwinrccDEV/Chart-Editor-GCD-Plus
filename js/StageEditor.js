// Stage Editor — panel del menú principal (placeholder "Próximamente")
// Port del sistema de GamerCB2026/PruebaCEGCD.

function abrirStageEditor() {
    if (typeof switchTab === "function") switchTab("stage");
}

function cerrarStageEditor() {
    if (typeof switchTab === "function") switchTab("recientes");
}
