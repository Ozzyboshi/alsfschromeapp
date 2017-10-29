var ids=[];
var floppyContentMenu = [];

var amigaRoot = chrome.contextMenus.create({
  title: "Download on amiga", 
  contexts:["link"], 
  // onclick: getword,
  //"targetUrlPatterns": ["*://*/*.adf","*://*/*.Adf","*://*/*.zip"]
  "targetUrlPatterns": ["*://*/*"]
});

function createFloppyContextMenu()
{
	chrome.storage.sync.get({
		ip: 'localhost',
		port: 8081
	},function (items)
	{
		doGETTxt("http://"+items.ip+":"+items.port+"/listFloppies", storeFloppyDrives);
	});
}

createFloppyContextMenu();

chrome.contextMenus.create({ 
          title: "Reload drives", 
		  parentId: amigaRoot,
          contexts:["link"], 
          onclick:  function(info, tab) { 
				for (var i=0;i<floppyContentMenu.length;i++)
				{
					console.log(floppyContentMenu);
					chrome.contextMenus.remove(floppyContentMenu[i]);
					floppyContentMenu.splice(i,1);
				}
				createFloppyContextMenu();
			}
        });

function getword(info,tab,drive) 
{    
	console.log(info.linkUrl);
	//doGET(info.linkUrl, handleFileData);
	//return ;
  	chrome.downloads.download(
	{
  		url: info.linkUrl
	},function (downloadId) 
	{
		console.log(downloadId);
		ids.push({"downloadId":downloadId,"drive":drive});
	});
}

function getAdf(info,tab,drive)
{
    console.log(info.linkUrl);
    console.log(drive);
    //test doGET(info.linkUrl, handleFileData,drive);
    getword(info,tab,drive);
}

chrome.downloads.onChanged.addListener(function(delta) 
{
	if (!delta.state || (delta.state.current != 'complete')) 
	{
		return;
	}
	console.log(delta.id);
    var index=0;
    var result=null;
    for (index = 0; index < ids.length; index++) 
    {
        if (ids[index].downloadId==delta.id)
        {
            result=ids[index];
            break;
        }
    }

	//if (ids.indexOf(delta.id)>=0)
    if (result)
	{
        drive = result.drive;
		console.log("Download terminato!!!!!)");
		console.log(ids);
		console.log(delta);
		//ids.splice(ids.indexOf(delta.id), 1);
        ids.splice(index, 1);
		console.log(ids);
		chrome.downloads.search({"id":delta.id}, function (result) {
			console.log(result[0].filename);
			doGET('file://'+result[0].filename, handleFileData, drive,result[0].id);
		});
	}
});

function storeFloppyDrives(info)
{
    if (info==null) return ;
    var drives = JSON.parse(info);
    for (var i = 0; i < drives.length; i++) 
    {
        console.log(drives[i].toString());
        var driveString = drives[i].toString();
         var floppyContext = chrome.contextMenus.create({ 
          title: drives[i], 
          contexts:["link"], 
          parentId: amigaRoot,
          onclick:  function(info, tab){ getAdf(info,tab,driveString.charAt(2));  }
        });
		floppyContentMenu.push(floppyContext);
    }
}

function handleFileData(fileData,drive,path,downloadId) {
    if (!fileData) {
        // Show error
        return;
    }
    console.log(parseInt(drive));
    console.log(fileData);

	var ext = path.substr(path.lastIndexOf('.') + 1);
    if (ext=='zip') handleZip(fileData,drive,downloadId);

	//console.log(fileData.length);
    //console.log(btoa(unescape(encodeURIComponent(fileData))));
	else if (ext=='adf')
	{
		var reader = new window.FileReader();
		reader.readAsDataURL(fileData); 
		reader.onloadend = function() {
		    chrome.storage.sync.get({
		        ip: 'localhost',
		        port: 8081
		        }, function(items) {
		            console.log(items.ip);
		            console.log(items.port);
		            base64data = reader.result;                
		            var adfB64Data = base64data.toString().split(',')[1] ;
		            var xmlhttp = new XMLHttpRequest();
					xmlhttp.onreadystatechange = function() 
    				{
						if (xmlhttp.readyState == 4) 
						{
							if (xmlhttp.status == 200) 
							{
								alert('Amiga image transfer succeeded');
								removeDownloadedFile(downloadId);
							}
							else 
							{
								alert('Amiga image transfer failed');
							}
						}
					};
		            xmlhttp.open("POST", "http://"+items.ip+":"+items.port+"/writeAdfB64");
		            xmlhttp.setRequestHeader("Content-Type", "application/json");
		            xmlhttp.send(JSON.stringify({trackDevice:parseInt(drive), adfB64Data: adfB64Data,start:0,end:79}));
		        });
		            
		}
	}
	else alert('Downloaded item is not a valid zip or adf file');
	//alert('done');
	return ;
	
}

function doGETTxt(path, callback) 
{

    var xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function() 
    {
        if (xhr.readyState == 4) 
        {
            console.log(xhr.status);
            if (xhr.status == 200) 
            {
                console.log("res "+xhr.responseText);
                callback(xhr.responseText);
            }
            else 
            {
                callback(null);
            }
        }
    };
    xhr.open("GET", path);
    xhr.send();
}

function doGET(path, callback, drive, downloadId) 
{

    var xhr = new XMLHttpRequest();
    xhr.responseType = "arraybuffer";

    xhr.onreadystatechange = function() 
	{
        if (xhr.readyState == 4) 
		{
            console.log(xhr.status);
            if (xhr.status == 200 || xhr.status == 0 ) 
			{
                var blob = new Blob([xhr.response]);
                callback(blob,drive,path,downloadId);
            }
			else 
			{
                callback(null,null,null);
			}
        }
    };
    xhr.open("GET", path);
    xhr.send();
}

function handleZip (f,drive,downloadId) {
    JSZip.loadAsync(f)
        .then(function(zip) {
            zip.forEach(function (relativePath, zipEntry) {
                console.log(zipEntry);
				console.log(zipEntry.name);
				console.log(zipEntry._data);
				console.log(zipEntry.d);
				var error=0;
				var ext = zipEntry.name.substr(zipEntry.name.lastIndexOf('.') + 1);
				if (ext !='adf') { alert('File '+zipEntry.name+' has not an adf extension'); error = 1; }
				else if (zipEntry._data.uncompressedSize!=901120) { alert('File '+zipEntry.name+' is not 901120 bytes long, cant send to the amiga'); error=1; }
                if (error==0)
				{
					zipEntry.async('blob').then(function (u8) {
		                var reader = new window.FileReader();
		                reader.readAsDataURL(u8); 
		                reader.onloadend = function() {
		                    chrome.storage.sync.get({
		                        ip: 'localhost',
		                        port: 8081
		                        }, function(items) {
		                            console.log(items.ip);
		                            console.log(items.port);
		                            base64data = reader.result;                
		                            var adfB64Data = base64data.toString().split(',')[1] ;
		                            var xmlhttp = new XMLHttpRequest(); 
									xmlhttp.onreadystatechange = function() 
									{
										if (xmlhttp.readyState == 4) 
										{
											if (xmlhttp.status == 200) 
											{
												alert('Amiga image transfer succeeded');
												removeDownloadedFile(downloadId);

											}
											else 
											{
												alert('Amiga image transfer failed');
											}
										}
									};  
		                            xmlhttp.open("POST", "http://"+items.ip+":"+items.port+"/writeAdfB64");
		                            xmlhttp.setRequestHeader("Content-Type", "application/json");
		                            xmlhttp.send(JSON.stringify({trackDevice:parseInt(drive), adfB64Data: adfB64Data,start:0,end:79}));
		                        }); // end of onloadend
		                            
		                }
		            }); // end of async
				} // end of error
            });
            console.log(zip);
        }, function (e) {
            console.log(e);
    });
}

function removeDownloadedFile(downloadId)
{
	chrome.downloads.removeFile(downloadId);
	chrome.downloads.erase({"id":downloadId});
}
