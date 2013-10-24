Facebook Comments to Gigya
===============

Export all Facebook comments submitted through their official widget into a format that can be imported into Gigya.

To run (no access token required), checkout this code and run the following:

	node import.js WORDPRESS_ROOT_URL WORDPRESS_USERNAME WORDPRESS_PASSWORD FACEBOOK_APP_ID FACEBOOK_SECRET GIGYA_API_KEY GIGYA_COMMENT_CATEGORY

Note: To fix a bug in one of the node modules, all of the dependecies are included (if wordpress api returns an invalid date, it will kill import process).
