var fs = require('fs');
var async = require('async');
var func = require('./inc/functions.js');
var Facebook = require('facebook-node-sdk');
var _ = require('underscore');

function getUrls(callback){
	if(fs.existsSync('./_urls.json')){
		console.log('Found post URLs from a previous run (_urls.json).');

		callback(null, require('./_urls.json'));
	}else{
		console.log('Retrieving all post URLs from wordpress installation (' + process.argv[2] + ').');

		func.wpGetAllPosts(function(err, urls){
			if(err){
				console.log(err);
			}else if(_.size(urls) == 0){
				console.log('The calls to wordpress returned no results, make sure you did everything correctly.');
			}else{
				console.log('Finished retrieving post URLs.');

				func.writeToFile(urls, '_urls.json', function(){
					console.log('Saved array of URLs to "_urls.json".');

					callback(null, urls);
				});
			}
		});
	}
}

function getComments(urls, callback){
	console.log('Processing urls: ' + _.size(urls));

	var comments = {};

	if(fs.existsSync('./_comments.json')){
		console.log('Found Facebook comments from a previous run (_comments.json).');

		comments = require('./_comments.json');

		console.log('Retrieving missing comments from Facebook Graph API.');
	}else{
		console.log('Retrieving all comments from Facebook Graph API.');
	}

	var queue = [];

	for(var url in urls){
		if(comments[url]){
			console.log('Skipped: ' + url);

			continue;
		}

		queue.push((function(url){return function(cb){
			func.getComments(url, function(err, comms){
				if(err){
					cb(err);
				}else{
					comments[url] = comms;

					func.writeToFile(comments, '_comments.json', function(err){
						console.log('Incrementally saving comments to "_comments.json".');

						cb(err);
					});
				}
			});
		}})(url));
	}

	async.series(queue, function(err){
		callback(err, comments);
	});
}

getUrls(function(err, urls){
	if(err){
		console.log(err);
	}else{
		getComments(urls, function(err, comments){
			if(err){
				console.log(err);
			}else{
				var gigya = func.convertToGigyaFormat(urls, comments);

				func.writeToFile(gigya, '_gigya.json', function(){
					console.log('Saved gigya comment export to  "_gigya.json".');
				});
			}
		});
	}
});