/**
 * Elastee
 *
 * Ejecutor de las órdenes de Elast dentro de cada máquina
 *
 */


modo_ec2 = false; // estamos en EC2 o local?
webPath = '.';
gitPass = '';

//INICIALIZACION
let id, ami, instance,
    http = require('http'),
    exec = require('child_process').exec,
    spawn = require('child_process').spawn,
    socket = require('socket.io-client').connect('http://127.0.0.1:4527');

//SH
sh = spawn('sh');
sh.stdout.on('data', function(data) {
	d = data.toString();
	socket.emit('linea', {id:id, contenido:d}) //avisar al Elast
});


/**
 * Te dice quien es trolo
 *
 * @param name
 * @param age
 * @returns {string}
 */
function trolo(name, age) {
    let nombre = name+'.';
    return `soy ${nombre} y tengo ${age}`
}

console.log(` tenemos un ${trolo(this, this)}`);

//CONEXION
socket.on('hi', function(){
	console.log('conectado a servidor');
	if (modo_ec2) {
		/*
		 * Usamos la técnica de Amazon para obtener datos de la máquina (ID del Ami y la Instance, y Hostname)
		 * para ello, hacemos llamadas asincrónicas usando http.get (wrapeado en mi función get()).
		 * Debido a la naturaleza asincrónica de http.get, necesitamos poner dentro del callback las tareas
		 * que dependen de la respuesta de la URL en cuestión.
		 *
		 * TODO:
		 * Quizás esta solución sea algo contraproducente y podría implementarse de mejor forma si el servidor
		 * registra inmediatamente la máquina y ésta envía las respuestas de cada http.get a medida que las obtiene.
		 * Entonces el servidor tendría que ir actualizando el objeto contenedor de la máquina con cada nuevo dato,
		 * y a su vez comunicárselo a los navegadores de la página web del Elast.
		 */
		get('http://169.254.169.254/latest/meta-data/instance-id', function(r){
			instance = r.toString();
			get('http://169.254.169.254/latest/meta-data/ami-id', function(r){
				ami = r.toString();
				get('http://169.254.169.254/latest/meta-data/hostname', function(hostname){
					socket.emit('hi', {ami:ami, instanceId:instance, host:hostname.toString()})
				})
			})
		})
	}
	else {
		rnd1 = Math.floor(Math.random()*100)+10;
		rnd2 = Math.floor(Math.random()*100)+10;
		socket.emit('hi', {ami:'local'+rnd1, instanceId:'local'+rnd2, host:'localhost'})
	}
});



//EVENTOS

exec('pwd', function(err,out) { console.log('cmd:',out)});
console.log('ruta:',__dirname);
socket.on('id', function(mi_id){
	//el servidor me dice mi ID, almacenarlo
	id=mi_id;
	console.log('almacenando ID: '+id)
});

socket.on('disconnect', function() {
	console.log('desconectado del servidor, reintentando conexion..')
});

socket.on('pull', function() {
	console.log('ejecutando git pull');
	socket.emit('pullIniciado', {id: id});
	if (!modo_ec2) { socket.emit('pullTerminado', {id: id, version:'debug'}); return } //debug

	exec('cd '+webPath+' && /usr/bin/expect -c "spawn git pull; expect \"*?assword*\"; send \"'+gitPass+'\r\r\" ; expect eof"',function(e,r) {
		console.log('pull finalizado, consultando version..');
		exec('cd '+webPath+' && git rev-parse HEAD',function(e,r) {
			console.log('pull finalizado, reportando version',r);
			socket.emit('pullTerminado', {id: id, version:r})
		})
	})
});

var procHistory = [];

socket.on('killProc', function (r) {
	console.log(`kill?`,r);
	if (r.maq!=id && r.maq!='*') {
		console.log('omitiendo kill para otra maquina ('+maquina+')')
	} else {
		console.log(`matando proceso`, r);
		procHistory[r.pid].kill()
	}
});

socket.on('ejecutar', function (r) {
	cmd = r.cmd;
	maquina = r.maq;

	//Filtrar si me corresponde (ver comentario en api.js para mas info)
	//TODO: Aqui podría ir un chequeo por un tercer parametro "omitir" por ejemplo
	//y omitir únicamente si el ID de esta máquina corresponde a ese parámetro
	//NOTA: si la maquina destino es '*' significa que le corresponde a todas
	if (maquina!=id && maquina!='*') {
		console.log('omitiendo comando para otra maquina ('+maquina+'): '+cmd)
	} else {

		console.log('ejecutando: '+cmd);

		var cmd = cmd.split(' ');
		var name = cmd.splice(0,1).toString();
		var args = cmd;

		var proc = spawn(name, args);
		if (proc.pid) {
			procHistory[proc.pid] = proc;
			socket.emit('procesoInicia', {id:id, pid:proc.pid, nombre:name}) //avisar al Elast
		}

		proc.stdout.on('data', function (data) {
			// console.log(`tengo data`, data)
			socket.emit('linea', {id:id, contenido:data+'\n'})
		});
		proc.on('error', function (err) {
			console.log(`no pude:`, name);
			socket.emit('linea', {id:id, contenido:'error ejecutando <b>'+name+'</b>\n'}) //avisar al Elast
		});
		proc.on('close', function (o) {
			console.log(`cerrado `, name);
			socket.emit('procesoMuere', {id:id, pid:proc.pid}) //avisar al Elast
		})

	}
});





//FUNCIONES

//emulador de curl usando http.get
function get (url, callback) {
	reg = url.match(/http:\/\/([\w\d\.]+)(\/[\w\d-\/]+)/);
	host = reg[1];
	path = reg[2];
	http.get({host:host, path:path}).on('response', function(r){ r.on('data', callback) })
}
