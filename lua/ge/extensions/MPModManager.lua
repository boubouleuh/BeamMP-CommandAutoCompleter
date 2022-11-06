--====================================================================================
-- All work by Titch2000 and jojos38.
-- You have no permission to edit, redistribute or upload. Contact BeamMP for more info!
--====================================================================================



local M = {}
print("Loading MPModManager...")

local serverMods = {} -- multiplayerModName1, multiplayerModName2
local whitelist = {"multiplayerbeammp", "beammp", "translations"} -- these mods won't be activated or deactivated

--TODO: build handler for repo mod downloads

local function isModAllowed(modName)
	for _,v in pairs(serverMods) do -- checking for server mods
		if string.lower(v) == string.lower(modName) then --[[ log('M', 'isModAllowed', modName .. ' is allowed.') ]] return true end
	end
	--log('W', 'isModAllowed', modName .. ' is not allowed.')
	return false
end
local function isModWhitelisted(modName)
	for _,v in pairs(whitelist) do
		if string.lower(v) == string.lower(modName) then --[[log('M', 'isModWhitelisted', modName .. ' is whitelisted.')]] return true end
	end
	return false
end
local function checkMod(mod) --TODO: might have a flaw with repo mods as their name is the repo ID and not the zip name
	--log('M', 'checkMod', 'Checking mod.modname: '..mod.modname)
	local modname = mod.modname
	local modAllowed = isModAllowed(modname)
	local modWhitelisted = isModWhitelisted(modname)

	if modWhitelisted then return end -- don't do anything with whitelisted mods

	if not modAllowed and mod.active then
		log('W', 'checkMod', "This mod should not be running: "..modname)
		core_modmanager.deactivateMod(modname)
		if mod.dirname == '/mods/multiplayer/' then
			core_modmanager.deleteMod(modname)
		end
	elseif modAllowed and not mod.active then
		log('W', 'checkMod', 'Inactive Mod but Should be Active: '..modname)
		core_modmanager.activateMod(modname)--'/mods/'..string.lower(v)..'.zip')
	elseif modAllowed and mod.active then
		log('M', 'checkMod', modname..' is already active. Not doing anything.')
	else
		--log('M', 'checkMod', modname..' is none of the above.')
	end
end

local function getModNameFromPath(path) --BeamNG function from extensions/core/modmanager.lua
	local modname = string.lower(path)
	modname = modname:gsub('/mods/', '')
	modname = modname:gsub('repo/', '')
	modname = modname:gsub('unpacked/', '')
	modname = modname:gsub('/', '')
	modname = modname:gsub('.zip$', '')
	return modname
end

local function getModList()
	local modsDB = jsonReadFile("mods/db.json")
	return modsDB.mods
end

local waitForFilesChanged = false
local function checkAllMods() --add counters?
	log('M', 'checkAllMods', 'Checking all mods...')
	for modname, mod in pairs(getModList()) do
		checkMod(mod)
	end
end

M.loadServerMods = function()
	log('W', 'loadServerMods', 'loadServerMods')
	
	local modsDir = FS:findFiles("/mods/multiplayer", "*.zip", -1, false, false)
	for _, modPath in pairs(modsDir) do
		core_modmanager.workOffChangedMod(modPath, 'added')
	end
	checkAllMods()
	MPCoreNetwork.requestMap()
end

M.verifyMods = function() -- verify that all server mods have actually been modLoaded
	local verifyTable = {}
	for _,v in pairs(serverMods) do
		verifyTable[v] = false -- set all values to false
	end
	for _,v in pairs(getModList()) do --go through the mod list
		for _,n in pairs(serverMods) do --check against the mods that are supposed to be loaded
			if v.modname == n then verifyTable[n] = true end
		end
	end
end


local function cleanUpSessionMods()
	log('M', "cleanUpSessionMods", "Deleting all multiplayer mods")
	local count = 0
	for modname, mod in pairs(getModList()) do
		if mod.dirname == "/mods/multiplayer/" and modname ~= "multiplayerbeammp" then
			count = count + 1
			core_modmanager.deleteMod(modname)
		end
	end
	log('M', "cleanUpSessionMods", count.." Mods cleaned up")
	log('M', "cleanUpSessionMods", "Unloading extensions...")
	unloadGameModules()
end


local function setServerMods(modsString) -- called from MPCoreNetwork
	if modsString == "" then log('M', 'setServerMods', 'Received no mods.') return end
	log('W', 'setMods', modsString)
	local mods = {}
	if (modsString) then -- takes: mod1.zip;mod2.zip;mod3.zip, returns a table of mod1,mod2,mod3
		for mod in string.gmatch(modsString, "([^;]+)") do
			local modFileName = mod:gsub(".zip",""):gsub(";","")
			table.insert(mods, modFileName)
		end
	end
	log('M', 'setServerMods', 'Server Mods set to: ' .. dumps(mods))
	for key, modName in pairs(mods) do -- mods in a directory deeper than /mods/ have "<directory name> + modname" as their mod name
		mods[key] = string.lower('multiplayer'..modName)
	end
	serverMods = mods
end

local function onModActivated(mod)
	log('M', 'onModActivated', mod.modname)
	if MPCoreNetwork.isMPSession() then
		checkMod(mod)
	end
end


local original_registerCoreModule

local function extensionLoader()
	original_registerCoreModule = registerCoreModule
	registerCoreModule = function(modulePath)
		--log('M', 'extensionLoader', modulePath)
		local debug = debug.getinfo(2)
		--dump(debug)
		debug = string.lower(debug.source)
		if string.match(debug, "beammp") then
			--log('W', 'extensionLoader', "Source is BeamMP! ".. debug)
		original_registerCoreModule(modulePath)
		elseif string.match(debug, "modscript") then
			log('W', 'extensionLoader', "Modscript attempting to register a core module! Falling back to queueExtensionToLoad " .. debug)
			queueExtensionToLoad(modulePath)
		else
			log('W', 'extensionLoader', "Source is not BeamMP or a modscript, running original function! ".. debug)
			original_registerCoreModule(modulePath)
		end
	end
end

local original_Unsubscribe = nop --TODO: finish this

M.replaceStuff = function() --TODO: if this function is called onExtensionLoaded core_repository is not loaded yet at that time
	if not core_repository and not core_repository.modUnsubscribe then log('W', 'replaceStuff', 'core_repository not loaded yet') return end
	original_Unsubscribe = core_repository.modUnsubscribe
	core_repository.modUnsubscribe = function(mod_id)
		if MPCoreNetwork and MPCoreNetwork.isMPSession() then
			log('W', 'replaceStuff', 'mod_id: ' .. mod_id)
			for k,modName in pairs(serverMods) do
				if modName == mod_id then
					log('W', 'replaceStuff', 'You cannot remove session mods! Exit the session to remove mods.')
					return
				else
					log('M', 'replaceStuff', 'Not a session mod, running original function.')
					original_Unsubscribe(mod_id)
				end
			end
		else
			log('M', 'replaceStuff', 'Not in an MP session, running original function.')
			original_Unsubscribe(mod_id)
		end
	end
end

M.onExtensionLoaded = function()
	cleanUpSessionMods()
	extensionLoader()
	--M.replaceStuff()
end

M.onExtensionUnloaded = function() -- restore functions back to their default values
	--core_repository.modUnsubscribe = original_Unsubscribe
	if original_registerCoreModule then registerCoreModule = original_registerCoreModule end
end

M.onServerLeave = function()
	if MPCoreNetwork.isMPSession() or MPCoreNetwork.isGoingMPSession() then
		log('W', 'onServerLeave', 'MPModManager')
		serverMods = {}
		cleanUpSessionMods() -- removes any leftover session mods
	end
end


M.cleanUpSessionMods = cleanUpSessionMods
M.setServerMods = setServerMods
M.checkAllMods = checkAllMods
M.isModWhitelisted = isModWhitelisted
M.isModAllowed = isModAllowed
M.getModList = getModList
--events
M.onModActivated = onModActivated

print("MPModManager loaded")
return M
