var wp = require('wordpress');
var Facebook = require('facebook-node-sdk');
var fs = require('fs');
var async = require('async');

var client = wp.createClient({
	url: process.argv[2],
	username: process.argv[3],
	password: process.argv[4]
});

var facebook = new Facebook({ appID: process.argv[5], secret: process.argv[6]}).setAccessToken("");

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

			var urls = [];

			for(var key in results){
				var result = results[key];

				urls.push(result['link']);
			}

			if(urls.length == 10){
				module.exports.wpGetPosts(function(err, moreurls){
					urls.push.apply(urls, moreurls);

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
			var urls = [];

			for(var name in data){
				var type = data[name];

				if(type.public && name != 'attachment'){
					queue.push((function(type){return function(cb){
						module.exports.wpGetPosts(function(err, moreurls){
							urls.push.apply(urls, moreurls);

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

	convertToGigyaFormat: function(urls){
		var authors = [];
		var commentCount = 0;
		var category = process.argv[8];
		var streams = [];

		for(var url in urls){
			var comms = urls[url];
			var comments = [];

			for(var key in comms){
				var comm = comms[key];

				var replies = [];

				if(comm.comments && comm.comments.data){
					for(var subkey in comm.comments.data){
						var reply = comm.comments.data[subkey];

						replies.push({
							"ID": reply.id,
							"guestName": reply.from.name,
							"guestEmail": "TODO",
							"commentText": reply.message,
							"state": "approved",
							"createDate": new Date(reply.created_time).getTime()
						});

						if(authors.indexOf(reply.from.name) == -1){
							authors.push(reply.from.name);
						}

						commentCount++;
					}
				}

				var comment = {
					"ID": comm.id,
					"guestName": comm.from.name,
					"guestEmail": "TODO",
					"commentText": comm.message,
					"state": "approved",
					"createDate": new Date(comm.created_time).getTime(),
					"replies": replies
				};

				if(authors.indexOf(comm.from.name) == -1){
					authors.push(comm.from.name);
				}

				comments.push(comment);

				commentCount++;
			}

			if(comments.length > 0){
				var stream = {
					"streamID": "TODO",
					"streamTitle": "TODO",
					"streamURL": url,
					"status": "enabled",
					"createDate": new Date().getTime(),
					"comments": comments
				};

				streams.push(stream);
			}
		}

		return {
			"settings": {
				"apikey": process.argv[7],
				"importFormat": "gigya-comments-nested-import",
				"totalCategories": 1,
				"totalStreams": urls.length,
				"totalAuthors": authors.length,
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