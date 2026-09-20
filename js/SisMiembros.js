/** Compat: carga el gate de clave (js/membresia.js). (Port de GamerCB2026/PruebaCEGCD) */
(function () {
  if (typeof window.iniciarSistemaMembresia === "function") {
    window.iniciarSistemaMembresia();
  }
})();
