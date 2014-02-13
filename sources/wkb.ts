
/*
**	file:			wkb.js
**	usage:			wkb create [name]				create a new project
					wkb add modulename				add a module on the current project
					wkb remove modulename			remove a module on the current project
					wkb list 						list modules used in the project
					wkb available 					list modules installed on your computer
					wkb start 						run the server
					wkb stop 						stop the server
					wkb info 						get project relative information
					wkb help						quick help / usage
					wkb build 						generate .js and .css from .wk files

**	config file:	.project.json
					.modules.json

	todo:
		- ameliorer le start
		- mettre en place un include

*/



declare var require;
declare var process;
declare var __dirname;

var fs = require('fs');
var cp = require('child_process');

// -- CONSTANT -- \\

var YESNO = /^(yes)|(y)|(no)|(n)$/;

// -- EXCEPTIONS -- \\

function BadArgument(msg) {
	var err = Error.call(this, msg);
	err.name = 'BadArgument';
	return (err);
}


// -- BUILDER -- \\

class 		Builder {
	options;
	project;
	config;
	needProject;

	constructor(options, project, config) {
		this.options 		= options;
		this.project 		= project;
		this.config 		= config;
		this.needProject 	= ['add', 'remove', 'list', 'build', 'start', 'stop', 'info'];
	}

	public run() {
		this.__checkProject();
			
		try { this[this.options.action](this.options.argument) } 
		catch (e) { 
			if (e.name === 'TypeError') 	{ throw Error('unknow option [' + this.options.action + ']' + e) }
			if (e.name === 'BadArgument') 	{ throw BadArgument('bad argument:' + e.message) }
			else 							{ throw (e.message) }
		}
		return (this.project);
	}

	// -- ACTIONS -- \\

	public create(arg) {
		var self = this;
		function interCreate(conf, argu) {
			self.__createFolders(['sources', 'www', 'www-server']);
			self.__setProjectOptions(argu[0]);
			self.__cpFile(__dirname  + '/../sources/templates/webkool.wk', './webkool.wk', {});
			self.__cpFile(__dirname  + '/../sources/templates/index.wk', './index.wk', conf);
		}

		if (arg.length !== 1 || typeof arg[0] !== 'string')
			throw BadArgument('you must specify a name for your project');
		var conf = {
			name: 	arg[0],
			port: 	'4242'
		};

		if (this.project !== null) {
			if (this.__ask('do you want to overwrite this project?', YESNO, function (data) {
				if (data === 'yes' || data === 'y')
					interCreate(conf, arg);
				process.exit();
			}))
			return (false);
		}
		else {
			interCreate(conf, arg);
		}	
	}

	public add(arg) {
		if (arg.length !== 1 || typeof arg[0] !== 'string')
			throw BadArgument('you must specify a name for the module');
		if (!this.__checkModule(arg[0]))
			throw Error('<' + arg[0] + '> file not found');
		if (this.project.module.indexOf(arg[0]) !== -1)
			throw Error('<' + arg[0] + '> already add');
		this.project.module.push(arg[0]);
		var mods = this.__getModules(true);
		var modsString = this.__prepareModuleInjection(mods);
		this.__cpFile(
			__dirname + '/../sources/templates/webkool.wk', 
			'./sources/webkool.wk', 
			modsString
		);
		this.config.needSave = true;
	}

	public remove(arg) {
		if (arg.length !== 1 || typeof arg[0] !== 'string')
			throw BadArgument('you must specify a name for the module');
		var idx = this.project.module.indexOf(arg[0])
		if (idx === -1)
			throw Error('module not added');
		this.project.module.splice(idx, 1);
		var mods = this.__getModules(true);
		var modsString = this.__prepareModuleInjection(mods);
		this.__cpFile(
			__dirname + '/../sources/templates/webkool.wk',
			'./sources/webkool.wk',
			modsString
		);
		this.config.needSave = true;
	}

	public list(arg) {
		var mods = this.__getModules(false);
		if (!mods.length)
			process.stdout.write('no module added\n');
		else
			process.stdout.write('module already added:\n');
		mods.forEach(function (itm) {
			process.stdout.write('\t- ' + itm + '\n');
		});
	}

	public available(arg) {
		var modules = fs.readdirSync(this.config.modulePath);
		if (!modules)
			process.stdout.write('No modules available on your system\n');
		process.stdout.write('Modules available:\n');
		modules.forEach(function (itm) {
			process.stdout.write('\t- ' + itm + '\n');
		});
	}

	public help(arg) {
		console.log('## WebKool Creator ##\n');
		console.log('USAGE: \twkb action [args]');
		console.log('ACTIONS:');
		console.log('\tcreate\t\t', 	'[name] create a new webkool project');
		console.log('\tadd\t\t', 		'[name] add a new module on the project');
		console.log('\tremove\t\t', 	'[name] remove the module');
		console.log('\tlist\t\t', 		'list installed modules');
		console.log('\tavailable\t', 	'list available modules');
		console.log('\tbuild\t\t', 		'build the project');
		console.log('\tstart\t\t', 		'start application');
		console.log('\tstop\t\t', 		'stop application');
		console.log('\tinfo\t\t', 		'get project relative information');
		console.log('\thelp\t\t', 		'quick help');
	}

	public build(arg) {
		this.__compileProjectFor('client');
		this.__compileProjectFor('server');
	}

	public start(arg) {
		var pid = this.__getPid();
		if (pid)
			console.log('server is already running');
		else {
			var command = 'node';
			var args = ['./www-server/' + this.project.name + '.js'];
			var out = fs.openSync('./stdout.log', 'a');
			var err = fs.openSync('./errout.log', 'a');
			console.log('stating server on port 4242');
			var child = cp.spawn(command, args, { detached: true, stdio: [ 'ignore', out, err ] });
			child.unref();
			console.log(child.pid);
			this.__setPid(child.pid);
			this.config.needSave = true;
		}
	}

	public stop(arg) {
		var pid = this.__getPid();
		if (!pid)
			console.log('server isn\'t running');
		else {
			process.kill(pid, process.SIGINT);
			this.__setPid(null);
			this.config.needSave = true;
		}
	}

	public info(arg) {
		console.log('name:\t\t', this.project.name);
		console.log('version:\t', this.project.version);
		console.log('module used:');
		if (this.project.module.length == 0) { console.log('\t\t none') }
		else {
			this.project.module.forEach(function (itm) {
				console.log('\t\t-', itm);
			});
		}
	}

	// -- FILE SYSTEM OPERATIONS -- \\

	private __createFolders(folders) {
		folders.forEach(function (name) {
			process.stdout.write('creating folder ' + name + '\n');
			try { fs.mkdirSync(name) }
			catch (e) {
				if (e.code !== 'EEXIST') { throw (e) }
			}
		});
	}

	private __cpFile(from, to, transform) {
		process.stdout.write('copying ' + from + ' to ' + to + '\n');
		var data = fs.readFileSync(from, 'utf8');
		if (transform != null)
			data = this.__injectInBuffer(data, transform);
		fs.writeFileSync(to, data);
	}
	// -- GETTER -- \\

	private __getPid() {
		if (this.project.hasOwnProperty('pid'))
			return (this.project.pid);
		return (null);
	}

	private __getModules(content) {
		var mods = [];
		var self = this;
		this.project.module.forEach(function (itm) {
			if (content) {
				var data = fs.readFileSync(self.config.modulePath + itm + '/.module.json');
				mods.push(JSON.parse(data));
			}
			else { mods.push(itm) }

		});
		return (mods);
	}

	// -- SETTER -- \\

	private __setPid(pid) {
		if (pid == null) {
			if (this.project.hasOwnProperty('pid'))
				delete this.project.pid;
		}
		else
			this.project.pid = pid;
	}

	private __setProjectOptions(name) {
		this.project = {
			name: 		name,
			version: 	this.config.version,
			module: 	[]
		};
		this.config.needSave = true;
	}

	// -- CHECKER -- \\

	private __updatePid(pid) {
		var command = 'ps';
		var args = ['-p', pid];
		var child = cp.spawn(command, args);
		var self = this;
		child.stdout.on('data', function (data) {
			var res = data.toString();
			if (data.toString().split('\n') <= 1)
				self.__setPid(null);
		});
	}

	private __checkProject() {
		if (this.project == null) {
			if (this.needProject.indexOf(this.options.action) === -1)
				return (true);
			throw Error('Not a webkool directory (or not build by the webkool builder)');
		}
		var p = this.project;
		if (!p.hasOwnProperty('name') ||
			!p.hasOwnProperty('version') ||
			!p.hasOwnProperty('module'))
			throw Error('.project.json: missing attribute');
		if (typeof p.name !== 'string' || typeof p.version !== 'string' || typeof p.module !== 'object')
			throw Error('.project.json: bad type for attribute');
		if (this.project.hasOwnProperty('pid'))
			this.__updatePid(this.project.pid);
		return (true);
	}

	private __checkModule(name) {
		var path = this.config.modulePath + name + '/.module.json';
		try { fs.statSync(this.config.modulePath + name + '/.module.json') }
		catch (ignore) { return (false) }
		return (true);
	}

	// -- PREPARE -- \\

	private __prepareModuleInjection(module) {
		var res = {
			scriptClient: 	'',
			scriptServer: 	'',
			initClient: 	'',
			initServer: 	''
		}
		var sb = '<script href=\''; var se = '\'></script>\n';
		module.forEach(function (itm) {
			res.scriptClient += (itm.scriptClient) 	? (sb + itm.scriptClient + se) : ('');
			res.scriptServer += (itm.scriptServer) 	? (sb + itm.scriptServer + se) : ('');
			res.initClient += (itm.initClient) 		? (itm.initClient + '\n') : ('');
			res.initServer += (itm.initServer) 		? (itm.initServer + '\n') : ('');
		});
		return (res);
	}

	// -- OTHERS -- \\

	private __injectInBuffer(buffer, model) {
		var re = /\{\{ (\w+) \}\}/g;
		buffer = buffer.replace(re, function (match, isolated) {
			return (model[isolated] || '');
		});
		return (buffer);
	}

	private __ask(question, format, callback) {
		process.stdin.resume();
		process.stdout.write(question + '  ');
		var self = this;
		process.stdin.once('data', function (data) {
			var res = data.toString().trim();
			if (format.test(res)) { return (callback(res)); }
			else { return (self.__ask(question, format, callback)) }
		});
	}

	private __compileProjectFor(mode) {
		var command = 'wkc';
		var args = ['--server', '-o', './www-server/' + this.project.name, 'index.wk'];
		if (mode == 'client')
			args = ['--client', '-o', './www/' + this.project.name, 'index.wk'];

		var child = cp.spawn(command, args);
		var res = '';
		var err = '';

		child.stdout.on('data', function (data) {
			res += data.toString();
		});
		child.stderr.on('data', function (data) {
			err += data.toString();
		});
		child.on('close', function () {
			process.stdout.write('-- ' + mode + ' build\n');
			process.stdout.write(res + '\n');
			process.stdout.write(err + '\n');
		})
	}
}





















// -- .PROJECT OPERATIONS -- \\

function 	readProject(config) {
	var data 	= '';
	var project = {};

	try { data = fs.readFileSync(config.projectFile, 'utf-8') }
	catch (ignore) { return (null) }
	try { project = JSON.parse(data) }
	catch (e) { throw Error('project file corrupted') }
	return (project);
}

function 	writeProject(config, project) {
	if (config.needSave && project != null)
		fs.writeFileSync(config.projectFile, JSON.stringify(project, null, 4));
}

// -- COMMAND LINE PARSING -- \\

function 	parseCmd(config) {
	var options = {
		action: 	'help',
		argument: 	[]
	}
	var argv = require('optimist')
			.alias('c', 'create')
			.alias('a', 'add')
			.alias('r', 'remove')
			.alias('l', 'list')
			.alias('d', 'available')
			.alias('b', 'build')
			.alias('f', 'info')
			.alias('h', 'help')
			.boolean(['list', 'start', 'stop', 'help', 'build', 'available', 'info'])
			.string(['create', 'add', 'remove'])
			.describe('create', 	'[name] create a new webkool project')
			.describe('add', 		'[name] add a new module on the project')
			.describe('remove', 	'[name] remove the module')
			.describe('list', 		'list installed modules')
			.describe('available', 	'list available modules')
			.describe('build', 		'build the project')
			.describe('start', 		'start application')
			.describe('stop', 		'stop application')
			.describe('info', 		'get project relative info')
			.describe('help', 		'quick help')
			.usage('$0' + ' version: ' + config.version)
			.argv;
	if (argv.create) 	{ options.action = 'create'; 	options.argument = [argv.create] }
	if (argv.add) 		{ options.action = 'add'; 		options.argument = [argv.add] }
	if (argv.remove) 	{ options.action = 'remove'; 	options.argument = [argv.remove] }
	if (argv.list) 		{ options.action = 'list' }
	if (argv.available) { options.action = 'available' }
	if (argv.build) 	{ options.action = 'build' }
	if (argv.start) 	{ options.action = 'start' }
	if (argv.stop) 		{ options.action = 'stop' }
	if (argv.info) 		{ options.action = 'info' }
	if (argv.help) 		{ options.action = 'help' }

	return (options);
}

// -- ENTRY POINT -- \\

function	main() {
	var config = {
		version: 		'0.0.1',
		projectFile: 	'.project.json',
		needSave: 		false,
		modulePath: 	__dirname + '/../modules/'
	};
	var options;
	var project;
	var builder;

	try {
		options = parseCmd(config);
		project = readProject(config);
		builder = new Builder(options, project, config);
		project = builder.run();

		writeProject(config, project);
	}
	catch (e) { process.stdout.write('An error occured:\n' + '\t' + e + '\n') }
}

main();

