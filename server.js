/**
 * Elast
 */




/*
 * NOTA: La conexion entre las maquinas y el server no necesita SSL
 * ya que se hará mediante la IP interna de Amazon y el puerto estará
 * bloqueado externamente en las políticas del grupo de seguridad.
 */



//vars
version = 2.3
puertoWeb = 9090
puertoSocketsMaquinas = 4527
puertoSocketsUI = 8080


//librerias
fs = require('fs')
qs = require('querystring')
http = require('http')
crypto = require('crypto')
Cookies = require('cookies')

//api
api = require('./api.js')({
	//exportar funciones locales para que las pueda usar la API
	ejecutarEnMaquinas: ejecutarEnMaquinas,
	md5: md5,
})




function filterAnsi(s) {
	return s.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')

}
/**
 * 🈴🈴🈴🈴🈴🈴🈴🈴🈴🈴
 * 🈴        MAQUINAS
 * 🈴🈴🈴🈴🈴🈴🈴🈴🈴🈴
 *
 * Se encarga de comunicar las máquinas entre sí, y enviar eventos a la UI
 *
 */
id=0
maquinas=[]
maq = require('socket.io').listen(puertoSocketsMaquinas).set('log level',5);
maq.sockets.on('connection', function(socket){

	//MAQUINA CONECTA
	console.log('maquina conectada, validando..')
	socket.emit('hi')

	//MAQUINA LISTA
	socket.on('hi', function(maq){
		id++;
		console.log('probandoo', socket.set)
		socket.set('id', id, function() {
			console.log('maquina validada, asignando id #'+id+' y anunciando..')
			maq.id=id;
			maq.version='default';
			maquina = maq;
			ui.sockets.emit('+maq', maquina);
			maquinas.push(maquina)
			socket.emit('id',id) //decir id a la maquina
		})
	})

	//MAQUINA SALE
	.on('disconnect', function() {
		socket.get('id', function(err, idm) { //idm = id de la maquina
			console.log('maquina #'+idm+' desconectada')
			ui.sockets.emit('-maq', idm)
			//TODO: alguna forma de quitar `maquina` del array `maquinas`
			maquinas = quitarMaquina(maquina, idm)
		})
	})

	//ACCIONES
	.on('pullIniciado', function(r) {
		console.log('maquina '+r.id+' inicia pull')
		ui.sockets.emit('pullIniciado', {id:r.id}) //notificar a las UI
	})

	.on('procesoMuere', function(r) {
		console.log('proceso muere', r)
		ui.sockets.emit('procesoMuere', r) //notificar a las UI
	})

	.on('procesoInicia', function(r) {
		console.log('proceso inicia', r)
		ui.sockets.emit('procesoInicia', r) //notificar a las UI
	})

	.on('pullTerminado', function(r) {
		actualizarMaquina (r.id, {version:r.version.substr(0,7)}) //actualizar datos de la máquina
		console.log('maquina',r.id,'finaliza pull version',r.version)
		ui.sockets.emit('pullTerminado', r) //notificar a las UI
	})

	.on('linea', function(r) {
		console.log('recibida linea de maquina',r)
		r.contenido=filterAnsi(r.contenido)
		ui.sockets.emit('linea', r)
	})

});


function ejecutarEnMaquinas (e, parms) {
	console.log('Ejecutando en todas las maquinas: ',e,parms?parms:'')
	maq.sockets.emit(e, parms?parms:'')
}


/**
 * ✅✅✅✅✅✅✅✅✅✅✅
 * ✅      WEB SERVER
 * ✅✅✅✅✅✅✅✅✅✅✅
 *
 * Se encarga de mostrar la UI de administración
 *
 */

http.createServer(function (req, res) {
	cookies = new Cookies(req,res)
	uri=(!req.url || req.url=='/'?'/index.html':req.url)

	//Distintos tipos de request
	//TODO: por el bien de la humanidad, ¡¡hay que implementar express!!
	if (uri=='/salir') {
		token = cookies.get('token')
		file = __dirname+'/logout.html'
		//aquí deben ir las acciones que eliminen el token de la base de datos
	}
	else if (uri=='/loguear') {
		var post=''
		req.on('data', function(data) {
			post+=data
		})

		req.on('end', function(data) {
			res.writeHead(200)
			post = qs.parse(post)
			token = generarSesion(post.usuario, post.clave)
			console.log('verificando',post.usuario,post.clave,token)
			if (token) {
				res.end('OK:'+token)
			} else {
				res.end('ERROR:usuario o clave invalidos')
			}
		})

	} else if (uri=='/index.html' && !validarSesion(cookies.get('sesion'))) {
		file = __dirname+'/login.html'
	} else {
		file=__dirname + uri;
	}

	//leer archivo y almacenarlo en `data`
	//readFile es asincrono, por lo tanto las acciones relacionadas con `data` deben ir dentro del callback
	fs.readFile(file, function (err, data) {
		if (err) {
			res.writeHead(404);
			return res.end('404 '+req.url);
		}

		//reemplazar variables del template
		//TODO: implementar sistema decente de templates
		if(uri=='/index.html') {
			data = data.toString().replace(/%version%/g,version)
		}


		//desplegar contenido
		ext = req.url.substr(-3)
		type = mime(ext)
		res.writeHead(200, { "Content-Type": type });
		console.log('sirviendo '+req.url)
		res.end(data);

	});


}).listen(puertoWeb)


/**
 * 🈸🈸🈸🈸🈸
 * 🈸    UI
 * 🈸🈸🈸🈸🈸
 *
 * Se encarga de actualizar la UI del webserver
 */
uid=0
ui = require('socket.io').listen(puertoSocketsUI).set('log level',0).on('connection', function(socket){
	uid++;
	console.log('usuario conectado, asignando ID '+uid+' y validando..')
	socket.emit('hi', {maquinas:maquinas, version:version})

	//eventos del navegador
	socket.on('hi', function(token){
		if (!validarSesion(token)) {
			socket.emit('tokenInvalido')
			console.log('Anti hack: usuario con token inválido: '+token)
			socket.disconnect()
		}
		console.log('usuario #'+uid+' validado')
	})
	socket.on('api', function(r) {
		if (!r.run) return socket.emit('aviso', 'Invocación incorrecta de la API, se necesita parámetro "run"');
		if (!api[r.run]) return socket.emit('aviso', 'Llamada de API inválida "'+r.run+'"');
		api[r.run](r, socket) //ejecutar llamada de api pasandole los parametros y el socket
	})
	socket.on('disconnect', function(r) {
		console.log('cliente #'+uid+' desconectado');
	})
});



//Funciones diversas

/*
 * TODO: Hacer que las máquinas tengan su ID como indice deel array para evitar el uso del for
 */
function quitarMaquina (m, idQuitar) {
  		nuevoArreglo=[]
		for(i in maquinas) {
			if(maquinas[i].id!=idQuitar) nuevoArreglo.push(maquinas[i])
		}
		return nuevoArreglo
}


/*
 * TODO: Hacer que las máquinas tengan su ID como indice deel array para evitar el uso del for
 */
function actualizarMaquina (idMaquina, propiedades) {
		console.log('actualizando parametros de maquina '+idMaquina)
		for(i in maquinas) {
			if(maquinas[i].id==idMaquina) {
				// console.log('detectada maquina a actualizar, mezclando objetos',maquinas[i],propiedades)
				for(parms in propiedades) {
					// console.log('actualizando parametro '+parms+' en maquina '+idMaquina+' a: '+propiedades[parms])
					maquinas[i][parms] = propiedades[parms]
				}
			}
		}
}


/**
 * Identifica el tipo de archivo mediante su extensión
 */
function mime (ext) {
	test = ext.split('.')
	if (test[1]) ext = test[1]
	mimes = {
		'js': 'text/javascript',
		'css': 'text/css',
	}
	tipo = mimes[ext]?mimes[ext]:'text/html';
	// console.log('tipo pa '+ext+' es '+tipo)
	return tipo
}

/**
 * Convierte cualquier texto a md5
 * @param {Object} texto
 */
function md5 (texto) {
	texto = texto.toString() //just in case :P
	return crypto.createHash('md5','ascii').update(texto).digest('hex')
}


/*
 * Valida un token de sesión (que fue entregado por las cookies del navegador)
 * TODO: Hacer una validación real en alguna base de datos
 * De momento el token debe decir "b1b3" y con eso se considera válido
 */
function validarSesion (token) {
	console.log('validando sesion.. ')
	if (token!='b1b3') return false
	return true
}

/*
 * Si los datos entregados son validos, genera un token de sesion
 * TODO: Hacer una validación real en alguna base de datos
 function generarSesion (user, pass) {
 */
 function generarSesion (user, pass) {
	if (user=='elast' && pass=='123') {
		return "b1b3";
	}
	return false;
}


//init
console.log('Elast 2 iniciado \n');
