
const {
	createReffedEventEmitterClass
} = await krequire('kernel/process/thread.js');



const createTwoWayStream = (contextIn, contextOut, options={}) => {
	options = Object.assign({}, options);
	
	const timersOut = contextOut.kernelModules.require('timers');
	const { Buffer } = contextIn.kernelModules.require('buffer');

	let input = null;
	let inputDestroyed = false;
	let output = null;
	let outputDestroyed = false;

	const { Writable } = contextIn.kernelModules.require('stream');

	class InStream extends Writable {
		_write(chunk, encoding, callback) {
			if(contextOut.valid && !outputDestroyed) {
				if(chunk instanceof Buffer) {
					output.push(chunk);
				}
				else {
					output.push(chunk, encoding);
				}
			}
			callback();
		}

		_destroy(err, callback) {
			inputDestroyed = true;
			if(callback) {
				callback();
			}
			if(!outputDestroyed) {
				output.push(null);
				output.destroy();
			}
		}
	}

	const { Readable } = contextOut.kernelModules.require('stream');
	let ReffedReadable = Readable;
	let updateOutputRef = null;
	if(options.threading) {
		let outputThread = null;
		let checkOutputRef = (outStream) => {
			if(output.listenerCount('data') > 0 && !outputDestroyed) {
				return true;
			}
			return false;
		};
		const { updateRefState, ReffedEventEmitter } = createReffedEventEmitterClass(contextOut, {baseClass: Readable}, checkOutputRef);
		updateOutputRef = updateRefState;
		ReffedReadable = ReffedEventEmitter;
	}

	class OutStream extends ReffedReadable {
		_read() {
			//
		}

		_destroy(err, callback) {
			outputDestroyed = true;
			if(updateOutputRef) {
				updateOutputRef(this);
			}
			if(callback) {
				callback();
			}
			this.emit('close');
		}
	}

	input = new InStream({emitClose:true});
	output = new OutStream();

	return {
		writer: input,
		reader: output
	};
}



module.exports = {
	createTwoWayStream
};
