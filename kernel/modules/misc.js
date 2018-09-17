
const {
	wrapThread
} = await krequire('kernel/process/thread.js');



module.exports = (context) => {
	// download data from a URL
	const download = (url) => {
		return wrapThread(context, {
			name: 'download:'+url,
			rethrowThreadKiller: true
		}, async () => {
			return await kernel.download(url);
		});
	};

	// export
	return {
		download
	};
}
