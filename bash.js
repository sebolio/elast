var spawn = require('child_process').spawn,
	util  = require('util'), sh
	
sh = spawn('sh')
sh.stdout.pipe(process.stdout)
sh.stdin.write('echo hi\n')


function escribe () {
	console.log('haciendo ls..'); 
	sh.stdin.write('ls\n')
}
setTimeout(function(){ escribe() }, 1000)
console.log('listo')
