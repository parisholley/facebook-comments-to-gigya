var wp = require('wordpress');
var Facebook = require('facebook-node-sdk');
var fs = require('fs');
var async = require('async');
var _ = require('underscore');
var config = require('../_config.json');

var client = wp.createClient({
	url: config.wordpress,
	username: config.username,
	password: config.password
});

var facebook = new Facebook({ appID: config.facebook_app, secret: config.facebook_secret}).setAccessToken("");

module.exports = {
	writeToFile: function(obj, file, callback){
		var json = JSON.stringify(obj, null, 4);

		fs.writeFile(file, json, function(err) {
			if(err){
				console.log(err);
			}else{
				callback(err);
			}
		}); 
	},

	wpGetPosts: function(callback, type, page){
		if(!page) page = 0;

		console.log('Page (' + type + '): ' + (page + 1));

		client.getPosts({
			fields: ['link'],
			number: 10,
			post_status: 'publish',
			post_type: type,
			offset: 10 * page
		}, function(err, results){
			if(err){
				callback(err, []);
				return;
			}

			var urls = {};

			for(var key in results){
				var result = results[key];

				urls[result['link']] = {
					title: result['title'],
					id: result['id'],
					type: result['type']
				};
			}

			if(_.size(urls) == 10){
				module.exports.wpGetPosts(function(err, moreurls){
					_.extend(urls, moreurls);

					callback(err, urls);
				}, type, page + 1);
			}else{
				callback(null, urls);
			}
		});
	},

	wpGetAllPosts: function(callback){
		client.getPostTypes(function(err, data){
			if(err){
				callback(err);
				return;
			}

			var queue = [];
			var urls = {};

			for(var name in data){
				var type = data[name];

				if(type.public && name != 'attachment'){
					queue.push((function(type){return function(cb){
						module.exports.wpGetPosts(function(err, moreurls){
							_.extend(urls, moreurls);

							cb(err);
						}, type)
					}})(name));
				}
			}

			async.series(queue, function(err){
				callback(err, urls);
			});
		});
	},

	facebookComments: function(url, callback){
		facebook.api(url, function(err, data) {
			if(err){
				callback(err, null);
			}else{
				var comments = [];

				var entry = null;

				if(data.data){
					entry = data;
				}else{
					for(var key in data){
						entry = data[key].comments;
					}
				}

				if(entry && entry.data){
					for(key in entry.data){
						var comment = entry.data[key];

						comments.push(comment);
					}
				}

				if(entry && entry.paging && entry.paging.next){
					module.exports.facebookComments(entry.paging.next, function(err, morecomments){
						if(err){
							callback(err, null);
						}else{
							comments.push.apply(comments, morecomments);

							callback(null, comments);
						}
					});
				}else{
					callback(null, comments);
				}
			}
		});
	},

	getComments: function(url, callback){
		console.log('Retrieving comments for: ' + url);

		module.exports.facebookComments('/comments/?fields=id,from,message,like_count,comments,created_time&ids=' + url, callback);
	},

	convertToGigyaFormat: function(urls, comments){
		var commentCount = 0;
		var category = config.gigya_category;
		var streams = [];

		_.each(urls, function(info, url){
			var comms = [];

			_.each(comments[url], function(comm){
				var replies = [];

				if(comm.comments && comm.comments.data){
					for(var subkey in comm.comments.data){
						var reply = comm.comments.data[subkey];

						replies.push({
							"ID": reply.id,
							"guestName": reply.from.name,
							"guestEmail": config.email,
							"commentText": reply.message,
							"state": "approved",
							"createDate": new Date(reply.created_time).getTime()
						});

						commentCount++;
					}
				}

				var comment = {
					"ID": comm.id,
					"guestName": comm.from.name,
					"guestEmail": config.email,
					"commentText": comm.message,
					"state": "approved",
					"createDate": new Date(comm.created_time).getTime(),
					"replies": replies
				};

				comms.push(comment);

				commentCount++;
			});

			if(comms.length > 0){
				var stream = {
					"streamID": info.type + '-' + info.id,
					"streamTitle": info.title,
					"streamURL": url,
					"status": "enabled",
					"createDate": new Date().getTime(),
					"comments": comms
				};

				streams.push(stream);
			}
		});

		return {
			"settings": {
				"apikey": config.gigya_key,
				"importFormat": "gigya-comments-nested-import",
				"totalCategories": 1,
				"totalStreams": urls.length,
				"totalComments": commentCount
			},
			"categories": [
				{
					"categoryID": category,
					"operationMode": "Comments",
					"streams": streams
				}
			]
		}
	}
};