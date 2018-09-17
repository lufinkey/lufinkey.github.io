
function getModeRWE(num) {
	var perm = {
		r: false,
		w: false,
		x: false
	};
	if(num >= 4) {
		num -= 4;
		perm.r = true;
	}
	if(num >= 2) {
		num -= 2;
		perm.w = true;
	}
	if(num >= 1) {
		num -= 1;
		perm.x = true;
	}
	return perm;
}

function readMode(mode) {
	mode = mode.toString(8);
	while(mode.length < 4) {
		mode = '0'+mode;
	}
	return {
		'sticky': getModeRWE(parseInt(mode[0])),
		'owner': getModeRWE(parseInt(mode[1])),
		'group': getModeRWE(parseInt(mode[2])),
		'world': getModeRWE(parseInt(mode[3]))
	};
}

function checkPerm(perm, neededPerms) {
	if(neededPerms.r && !perm.r) {
		return false;
	}
	if(neededPerms.w && !perm.w) {
		return false;
	}
	if(neededPerms.x && !perm.x) {
		return false;
	}
	return true;
}

function validatePermission(context, uid, gid, mode, perm) {
	mode = readMode(mode);
	if(context.uid == uid && checkPerm(mode.owner, perm)) {
		return;
	}
	else if(context.gid == gid && checkPerm(mode.group, perm)) {
		return;
	}
	else if(checkPerm(mode.world, perm)) {
		return;
	}
	/*console.log(context);
	console.log({
		uid: uid,
		gid: gid,
		mode: mode
	});
	console.log(perm);*/
	throw new Error("Access Denied");
}


module.exports = {
	getModeRWE,
	readMode,
	checkPerm,
	validatePermission
};
