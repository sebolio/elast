/**
 * Elast UI
 */


var ajaxurl = 'api/run'; //inspirado en WP
var socket=io.connect('http://localhost:8080');
var maquinas=[];
var version=false;
var reintentar=true;
var lineasReales=true; //considerar saltos de linea (\n) al ingresar lineas a la consola
var orderedKill=[];


/**
 *
 * eventos de socket.io
 *
 */

socket.on('+maq', function(r) {
	console.log('Nueva maquina',r)
	agregarMaquina(r, true)
})

socket.on('-maq', function(r) {
	console.log('Quitando maquina',r)
	quitarMaquina(r)
})

socket.on('disconnect', function(r) {
	maquinas=[] //limpiar arreglo de maquinas
	if(reintentar) {
		console.log('Se perdió conexión con servidor!! Reintentando...')
	} else {
		console.log('Desconectado del servidor. Recargar página para volver a conectar.')
	}
	avisoEnTabla('error', 'Conexión perdida con servidor!!!')
})

socket.on('tokenInvalido', function() { alert('Servidor dice que el token de sesión es inválido!')})
socket.on('hi', function(r) {
	if(!version) version=r.version
	else if (r.version != version) {
		reintentar=false
		socket.disconnect()
		recargar()
	}
	console.log('Respondiendo saludo a nodeserver y poblando tabla:',r);
	socket.emit('hi', $.cookie('sesion')); //validar sesión con token almacenado en cookies

	//agregar todas las maquinas a la tabla
	limpiarListaMaquinas()
	if(r.maquinas.length>0) {
		for(i in r.maquinas) {
			console.log('llamando a AgregarMaquina',r.maquinas[i])
			agregarMaquina(r.maquinas[i], false)
		}
	} else {
		avisoNoHayMaquinas()
	}
})

socket.on('aviso', function(r) {
	console.log('Aviso del server: '+r)
})

var procesosVivos = []
socket.on('procesoMuere', function(r) {
	console.log('Muere proceso', r)
	consola.procesoMuere(r)
	delete procesosVivos[r.pid]

})
socket.on('procesoInicia', function(r) {
	console.log('Inicia proceso', r)
	consola.procesoInicia(r)
	procesosVivos[r.pid] = r.id
})

socket.on('pullIniciado', function(r) {
	console.log('Maquina '+r.id+' ha comenzado a hacer PULL')
	$('#maq_'+r.id+' td:nth(4)').html('Esperando pull..')
})

socket.on('pullTerminado', function(r) {
	console.log('Maquina '+r.id+' ha terminado de hacer PULL',r)
	$('#maq_'+r.id+' td:nth(4)').html(r.version.substr(0,7))
})

socket.on('linea', function(r) {
	// console.log('agregando linea',r)
	if (lineasReales) {
		lineas=r.contenido.split('\n')
		for(i in lineas) {
			if(i!=lineas.length-1) //saltar la ultima linea q generalmente es un \n
				consola.agregarLinea(r.id, lineas[i])
		}
	} else {
			consola.agregarLinea(r.id, lineas[i].replace(/\n/g,'</p><p>'))
	}
})


// funciones

function api (accion, parms) {
	console.log('Enviando llamado a la API: ', accion, parms)
	socket.emit('api', {run: accion, parms: parms})
}

function killProc (id, pid) {
	console.log(`pidiendo matar proceso`, id, pid)
	orderedKill[id+'_'+pid] = true;
	api('killProc', {maq: id, pid:pid})
}

function agregarMaquina (maq, fade) {
	if(maquinas.length==0) limpiarListaMaquinas()
	maquinas.push(maq)
	console.log('agregando maquina',maq)

	//agregar máquina a tabla
	$tr = $('<tr id="maq_'+maq.id+'" class="maquina" onclick="consola.abrir('+maq.id+')">')
	if(fade) $tr.fadeTo(0)
	$('<td>'+maq.id+'</td>').appendTo($tr)
	$('<td>'+maq.instanceId+'</td>').appendTo($tr)
	$('<td>'+maq.ami+'</td>').appendTo($tr)
	$('<td>'+maq.host+'</td>').appendTo($tr)
	$('<td>'+maq.version+'</td>').appendTo($tr)
	$('<td></td>').append($('#acciones-maquinas').html().replace(/%id%/g,maq.id)).appendTo($tr)
	$('#listaMaquinas tbody').append($tr)

	//agregar pestaña de consola
	$tab = '<li><a id="controltab'+maq.id+'" href="#tab'+maq.id+'" data-toggle="tab">'+maq.instanceId+' <span class="badge badge-important" style="display:none">0</span></a></li>';
	$('#consolas .nav.nav-tabs').append($tab)

	//agregar pestaña de consola
	$tab = '<div class="tab-pane" id="tab'+maq.id+'"><div class="consola"><p>Host: '+maq.host+', ID: '+maq.id+'</p></div>';
	$('#consolas .tab-content').append($tab)

	//agregar a lista "dónde ejecutar" comando
	$('#dondeEjecutar').append('<option value="'+maq.id+'">'+maq.instanceId+'</option>')


	if(fade) $tr.fadeTo(300,1);

}

function recargar () {
	if(confirm(('El servidor requiere que se vuelva a cargar la página.'))) {
		location.reload()
	} else {
		setTimeout(recargar, 5000)
	}
}
function quitarMaquina (id) {

	//quitar de la tabla
	$('#maq_'+id).fadeTo(300,0, function(){ $(this).remove() })

	//quitar de la ventana de consolas y activar historial
	$('#controltab'+id).fadeTo(300,0, function(){
		$(this).remove()
		$('#tab'+id).remove()
		$('#controltabhistorial').tab('show')
	})

	//quitar del arreglo
	nuevoArreglo=[]
	for(i in maquinas) {
		console.log('analizando maquina aer si la quito.. id es '+maquinas[i].id)
		if(maquinas[i].id!=id) nuevoArreglo.push(maquinas[i])
	} maquinas = nuevoArreglo

	//quitar de lista "dónde ejecutar"
	$('#dondeEjecutar option[value="'+id+'"]').remove()


	//detectar si era la última máquina
	if(maquinas.length==0) avisoNoHayMaquinas()

}

function avisoEnTabla (clase, aviso) {
	limpiarListaMaquinas()
	$('#listaMaquinas tbody').html('<tr class="'+clase+'"><td>'+aviso+'</td><td></td><td></td><td></td><td></td><td></td></tr>')
}

function avisoNoHayMaquinas () {
	avisoEnTabla('success', 'Conectado al servidor pero no hay máquinas.')
}

function limpiarListaMaquinas () {
	$('#listaMaquinas tbody').html('')
}

//consolas
consola = {

	badgeAumentando: false, //TODO
	agregarLinea: function(id, texto) {
		if (!consola.badgeAumentando) {
			if($('#consolas').hasClass('in') && $('#tab'+id).hasClass('active')) {}
			else consola.aumentarBadge(id)
			$('#tab'+id+' .consola').append('<p>'+texto+'</p>')
			consola.hastaElFondo(id)

			//TODO fix para que PING no mande 2 lineas: hay q pensarlo mejor
			// consola.badgeAumentando = true;
			// setTimeout(function () {consola.badgeAumentando = false}, 1)
		}
	},

	procesoInicia: function (r) {
		$('#tab'+id).append('<div class="proc" id="proc'+r.id+'_'+r.pid+'">Corriendo: <b>'+r.nombre+'</b> ('+r.pid+') - <a href="javascript:killProc('+r.id+','+r.pid+')">Matar</a></div>')
	},

	procesoMuere: function (r) {
		$('#proc'+r.id+'_'+r.pid).remove()
		if (orderedKill[r.id+'_'+r.pid]) {
			consola.agregarLinea(r.id, 'Killed '+r.pid)
			delete orderedKill[r.id+'_'+r.pid]
		}
	},

	hastaElFondo: function(id) {
		$cons = $('#consolas #tab'+id+' .consola')
		// $cons.animate({scrollTop: $cons[0].scrollHeight}, 100)
		$cons.scrollTop($cons[0].scrollHeight)
	},

	abrir: function(id) {
		$('#consolas').modal('show')
		$('#consolas #controltab'+id).tab('show')
	},

	aumentarBadge: function(id) {
		$badge = $('#controltab'+id+' .badge, #maq_'+id+' .badge')
		total = parseInt($badge.html())
		$badge.html(++total).fadeIn(100)
	},

	limpiarBadge: function(id) {
		$badge = $('#controltab'+id+' .badge, #maq_'+id+' .badge')
		$badge.fadeOut(100, function(){$(this).html('0')})
	},

	txtEjecutar: function(txt) {
		$('#nuevoComando').val(txt).focus()
	},
}


// ejecutar al terminar de cargar

$(function(){

	//asignar evento CLIC a los tabs
	$('#consolas ul.nav.nav-tabs').on('shown', function(e) {
		id = $(e.target).attr('href').replace('#tab','') //determinar ID
		consola.limpiarBadge(id) //limpiar badge
		consola.hastaElFondo(id) //desplazar hasta el final
		$('#dondeEjecutar').val(id) //marcar esta consola para ejecutar
		$('#nuevoComando').focus() //activar foco en input de comandos

	})

	//desplazar historial hasta el final al iniciar
	consola.hastaElFondo('historial')

	//nuevo comando
	$('#nuevoComando')
	 .popover({placement:'bottom', trigger:'hover'}) //mostrar cartelito informativo
	 .blur(function(){$(this).popover('destroy')}) //destruir cartelito al salirse del input
	 .keydown(function(e){
	 	$(this).popover('hide') //destruir cartelito al presionar una tecla
	 	if(e.keyCode==13) {
	 		//usuario presiona ENTER
		 	cmd = $(this).val()
		 	donde = $('#dondeEjecutar').val()
		 	console.log('ejecutando "'+cmd+'" en '+donde)
		 	consola.agregarLinea('historial','<a href="javascript:consola.txtEjecutar(\''+cmd+'\')">'+cmd+'</a>')
		 	$(this).val('')
		 	api('ejecutar', {maq: donde, cmd:cmd})
	  	}
	  })

	//volver al historial al cerrar consolas
	$('#consolas').on('hidden', function() { $('#controltabhistorial').tab('show') })
})
