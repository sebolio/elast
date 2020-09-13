/**
 * API de Elast
 *
 * Permite a los usuarios interactuar con las máquinas que se encuentran
 * conectadas al Elast, sin comunciarse con ellas directamente.
 *
 * La razón por la que esto está separado del server.js y no usa eventos,
 * es para que en un futuro se puedan tener otras formas de acceder a esto,
 * ya sea mediante CLI, REST, aplicaciones nativas, etc
 *
 *
 * para incluír en el servidor:
 * 	var api = require('./api.js')({f1:f1, f2:f2})
 *
 * en este ejemplo se le está pasando un objeto con definiciones de
 * funciones (f1 y f2) para que las pueda utilizar la este archivo,
 * ya que NodeJS no hereda definiciones al utilizar require()
 *
 */


api = function(base) {
	return {
		ver: function(a, b) {
			return 1;
		},

		pull: function(r, socket) {
			console.log('Ejecutando pull en todas las máquinas..')
			base.ejecutarEnMaquinas('pull')
		},

		ejecutar: function(r) {
			//se usa el sistema tradicional de que TODAS las maquinas reciban la peticion
			//y luego cada maquina filtra si le corresponde ejecutarlo o no
			//esto es así por dos razones: primero, para aprovechar funciones que
			//estaban hechas al momento de agregar esta funcionalidad; y segundo
			//porque de esta forma se pueden crear filtros avanzados en el futuro
			//sin escribir nada de codigo a nivel del servidor o de los musicos,
			//por ejemplo para que un comando se ejecute en todas menos en XX
			base.ejecutarEnMaquinas('ejecutar', r.parms)
		},

		killProc: function (r) {
			base.ejecutarEnMaquinas('killProc', r.parms)
		}

	}
}

//exportar al invocador
module.exports = api
