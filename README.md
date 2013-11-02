Facebook Comments to Gigya
===============

Export all Facebook comments submitted through their official widget into a format that can be imported into Gigya.

To run (no access token required), checkout this code and create a file called _config.json with the following info:

	{
		"wordpress": "http://wordpressinstall.com",
		"username": "wordpressUser",
		"password": "worpdressPass",
		"facebook_app": "",
		"facebook_secret": "",
		"gigya_key": "",
		"gigya_category": "",
		"email": "" // facebook doesn't disclose emails so u must provide a dummy email to use for importing
	}

After creating the config file simply run:

	node import.js

Note: To fix a bug in one of the node modules, all of the dependecies are included (if wordpress api returns an invalid date, it will kill import process).
