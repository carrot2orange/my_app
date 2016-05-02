var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var Post = require('../models/Post');

router.get('/', function(req,res){
  Post.find({}).populate("author").sort('-createdAt').exec(function(err,posts){
    if(err) return res.json({success:false, message:err});
    res.render("posts/index", {posts:posts, user:req.user});
  });
}); // index
router.get('/new', isLoggedIn, function(req,res){
  res.render("posts/new", {user:req.user,
                           formPost: req.flash('formPost')[0],
                           titleError: req.flash('titleError')[0],
                           bodyError: req.flash('bodyError')[0]
                          }
 );
}); // new
router.post('/', isLoggedIn, checkPostValidationN, function(req,res){
  req.body.post.author=req.user._id;
  Post.create(req.body.post, function(err,post){
    if(err){
      console.log(req.body);
      console.log(err);
    return res.json({success:false, message:err});
    }
    res.redirect('/posts');
  });
}); // create
router.get('/:id', function(req,res){
  Post.findById(req.params.id).populate("author").exec(function(err,post){
    if(err) return res.json({success:false, message:err});
    res.render("posts/show", {post:post, user:req.user});
  });
}); // show
router.get('/:id/edit', isLoggedIn, function(req,res){
  Post.findById(req.params.id, function(err,post){
    if(err) return res.json({success:false, message:err});
    if(!req.user._id.equals(post.author)) return res.json({success:false, message:"Unauthodrized Attempt"});
    res.render("posts/edit", {post:post,
                              user:req.user,
                              formPost: req.flash('formPost')[0],
                              titleError: req.flash('titleError')[0],
                              bodyError: req.flash('bodyError')[0]});
  });
}); // edit
router.put('/:id', isLoggedIn, function(req,res){
  req.body.post.updatedAt=Date.now();
  Post.findOneAndUpdate({_id:req.params.id, author:req.user._id}, req.body.post, function(err, post){
    if(err) return res.json({success:false, message:err});
    if(!post) return res.json({success:false, message:"No data found to update"});
    checkPostValidationE(req, res);
});
}); // update
router.delete('/:id', function(req,res){
  Post.findOneAndRemove({_id:req.params.id, author:req.user._id}, function(err,post){
    if(err) return res.json({success:false, message:err});
    if(!post) return res.json({success:false, message:"No data found to delete"});
    res.redirect('/posts');
 });
}); // destroy

function isLoggedIn(req, res, next){
  if(req.isAuthenticated()){
    return next();
  }
  res.redirect('/');
}
function checkPostValidationN(req, res, next){
  var isValid = true;
  if(req.body.post.title === '' && req.body.post.body === ''){
    isValid = false;
    req.flash("formPost", req.body.post);
    req.flash("titleError", " - This title is required.");
    req.flash("bodyError", " - This body is required.");
    res.redirect('/posts/new');
  }
  else if(req.body.post.title === ''){
    isValid = false;
    req.flash("formPost", req.body.post);
    req.flash("titleError", " - This title is required.");
    res.redirect('/posts/new');
  }
  else if(req.body.post.body === ''){
    isValid = false;
    req.flash("formPost", req.body.post);
    req.flash("bodyError", " - This body is required.");
    res.redirect('/posts/new');
  }
  else
    return next();
}
function checkPostValidationE(req, res){
  var isValid = true;
  Post.findById(req.params.id, function(err,post){
    if(post.title === '' && post.body === ''){
      isValid = false;
      req.flash("formPost", post);
      req.flash("titleError", " - This title is required.");
      req.flash("bodyError", " - This body is required.");
      res.redirect('/posts/'+req.params.id+"/edit");
    }
    else if(post.title === ''){
      isValid = false;
      req.flash("formPost", post);
      req.flash("titleError", " - This title is required.");
      res.redirect('/posts/'+req.params.id+"/edit");
    }
    else if(post.body === ''){
      isValid = false;
      req.flash("formPost", post);
      req.flash("bodyError", " - This body is required.");
      res.redirect('/posts/'+req.params.id+"/edit");
    }
    else{
      res.redirect('/posts/'+req.params.id);
    }

  });
}



module.exports = router;
