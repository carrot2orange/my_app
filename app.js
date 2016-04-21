// import modules
var express = require('express');
var path = require('path');
var app = express();
var mongoose = require('mongoose');
var passport = require('passport');
var session = require('express-session');
var flash = require('connect-flash');
var async = require('async');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');

// connect database
mongoose.connect(process.env.MONGO_DB);
var db = mongoose.connection;
db.once("open", function(){
  console.log("DB connected!");
});
db.on("error", function(err){
  console.log("DB ERROR :", err);
});

// model setting
var postSchema = mongoose.Schema({
  title: {type:String, required:true},
  body: {type:String, required:true},
  createdAt: {type:Date, default:Date.now},
  updatedAt: Date
});
var Post = mongoose.model('post', postSchema);
var bcrypt = require("bcrypt");
var userSchema = mongoose.Schema({
  email: {type:String, required:true, unique:true},
  nickname: {type:String, required:true, unique:true},
  password: {type:String, required:true},
  createdAt: {type:Date, default:Date.now}
});
userSchema.pre("save", function(next){
  var user = this;
  if(!user.isModified("password")){
    return next();
  } else {
    user.password = bcrypt.hashSync(user.password,0);
    return next();
  }
});
userSchema.methods.authenticate = function(password){
  var user = this;
  return bcrypt.compareSync(password, user.password);
};
var User = mongoose.model('user', userSchema);

var errorHelper = require('mongoose-error-helper').errorHelper;

//if(err) return errorHelper(err, next);


// view setting
app.set("view engine", 'ejs');

// set middlewares
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json()); // 다른 프로그램이 JSON으로 데이터 전송할 경우 받는 body parser
app.use(bodyParser.urlencoded({extended:true})); // 웹사이트가 JSON으로 데이터를 전송할 경우 ~
app.use(methodOverride("_method"));
app.use(flash());

app.use(session({
  secret:'MySecret',
  resave: true,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user, done){
  done('', user.id);
});
passport.deserializeUser(function(id, done){
  User.findById(id, function(err, user){
    done(err, user);
  });
});

//var validate = require('mongoose-validator');


var LocalStrategy = require('passport-local').Strategy;
passport.use('local-login',
  new LocalStrategy({
    usernameField : 'email',
    passwordField : 'password',
    passReqToCallback : true
  },
  function(req, email, password, done){
    User.findOne({'email' : email }, function(err, user){
      if (err) return done(err);

      if (!user){
          req.flash("email", req.body.email);
          console.log(user);
          return done('', false, req.flash('loginError', 'No user found.'));
      }
      if(!user.authenticate(password)){
          req.flash("email", req.body.email);
          return done('', false, req.flash('loginError', 'Password does not Match.'));
      }
      return done('', user);
    });
  }
 )
);
// set home routes
app.get('/', function(req,res){
  res.redirect('/posts');
});
app.get('/login', function(req,res){
  res.render('login/login',{email:req.flash("email")[0], loginError:req.flash('loginError')});
});
app.post('/login',
  function (req, res, next){
    req.flash("email"); // flush email data
    if(req.body.email.length === 0 || req.body.password.length === 0){
      req.flash("email", req.body.email);
      req.flash("loginError", "Please enter both email and password.");
      res.redirect('/login');
    } else {
      next();
    }
  }, passport.authenticate('local-login',{
    successRedirect : '/posts',
    failureRedirect : '/login',
    failureFlash : true
  })
);
app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

// set user routes
app.get('/users/new', function(req, res){
  res.render('users/new', {
                            formData: req.flash('formData')[0],
                            emailError: req.flash('emailError')[0],
                            nicknameError: req.flash('nicknameError')[0],
                            passwordError: req.flash('passwordError')[0]
                          }
  );
}); // new
app.post('/users', checkUserRegValidation, function(req, res, next){
  /*var user = new User({
    email: req.body.email,
    nickname: req.body.nickname,
    password: req.body.password,
    createdAt: req.body.createdAt
  });*/
  //console.log(user);
  User.create(req.body.user, function(err, user){
    if(err){
      errorHelper(err, next);
      console.log(req.body);
      console.log(err);
      return res.json({success:false, message:err});
    }
    res.redirect('/login');
  });
}); // create
app.get('/users/:id', isLoggedIn, function(req, res){
  User.findById(req.params.id, function(err, user){
    if(err){
      errorHelper(err, next);
      console.log(req.body);
      return res.json({success:false, message:err});
    }
    res.render("users/show", {user:user});
  });
}); // show
app.get('/users/:id/edit', isLoggedIn, function(req, res){
  if(req.user._id != req.params.id) return res.json({success:false, message:"Unauthorized Attempt"});
  User.findById(req.params.id, function(err, user){
    if(err) return res.json({success:false, message:err});
    res.render("users/edit", {
                                user: user,
                                formData: req.flash('formData')[0],
                                emailError: req.flash('emailError')[0],
                                nicknameError: req.flash('nicknameError')[0],
                                passwordError: req.flash('passwordError')[0]
                              }
    );
  });
}); // edit
app.put('/users/:id', isLoggedIn, checkUserRegValidation, function(req, res){
  if(req.user._id != req.params.id) return res.json({success:false, message:"Unauthorized Attempt"});
  User.findById(req.params.id, req.body.user, function(err, user){
    if(err) return res.json({success:"false", message:err});
    if(user.authenticate(req.body.user.password)){
      if(req.body.user.newPassword){
        //console.log(req.body.user);
        //req.body.user.password = req.body.user.password;
        user.password = req.body.user.newPassword;
        user.save();
      } else {
        delete req.body.user.password;
      }
      User.findByIdAndUpdate(req.params.id, req.body.user, function(err, user){
        if(err) return res.json({success:"false", message:err});
        res.redirect('/users/'+req.params.id);
      });
    } else {
      req.flash("formData", req.body.user);
      req.flash("passwordError", "- Invalid password");
      res.redirect('/users/'+req.params.id+"/edit");
    }
  });
}); // update

// set posts routes
app.get('/posts', function(req,res){
  Post.find({}).sort('-createdAt').exec(function(err,posts){
    if(err) return res.json({success:false, message:err});
    res.render("posts/index", {data:posts, user:req.user});
  });
}); // index
app.get('/posts/new', function(req,res){
  res.render("posts/new");
}); // new
app.post('/posts', function(req,res){
  Post.create(req.body.post, function(err,post){
    if(err) return res.json({success:false, message:err});
    res.redirect('/posts');
  });
}); // create
app.get('/posts/:id', function(req,res){
  Post.findById(req.params.id, function(err,post){
    if(err) return res.json({success:false, message:err});
    res.render("posts/show", {data:post});
  });
}); // show
app.get('/posts/:id/edit', function(req,res){
  Post.findById(req.params.id, function(err,post){
    if(err) return res.json({success:false, message:err});
    res.render("posts/edit", {data:post});
  });
}); // edit
app.put('/posts/:id', function(req,res){
  req.body.post.updatedAt=Date.now();
  Post.findByIdAndUpdate(req.params.id, req.body.post, function(err,post){
    if(err) return res.json({success:false, message:err});
    res.redirect('/posts/'+req.params.id);
  });
}); // update
app.delete('/posts/:id', function(req,res){
  Post.findByIdAndRemove(req.params.id, function(err,post){
    if(err) return res.json({success:false, message:err});
    res.redirect('/posts');
  });
}); // destroy
// functions
function isLoggedIn(req, res, next){
  if(req.isAuthenticated()){
    return next();
  }
  res.redirect('/');
}

function checkUserRegValidation(req, res, next){
  var isValid = true;

  async.waterfall(
    [function(callback){
      User.findOne({email: req.body.user.email, _id: {$ne: mongoose.Types.ObjectId(req.params.id)}},
        function(err, user){
          if(user){
            isValid = false;
            req.flash("emailError", "- This email is already registered.");
          }
          callback('', isValid);
        }
      );
    }, function(isValid, callback){
      User.findOne({nickname: req.body.user.nickname, _id: {$ne: mongoose.Types.ObjectId(req.params.id)}},
    function(err, user){
      if(user){
        isValid = false;
        req.flash("nicknameError","- This nickname is already registered.");
      }
      callback('', isValid);
    }
  );
}], function(err, isValid){
      if(err){
        errorHelper(err, next);
        console.log(req.body);
        console.log(err);
        return res.json({success:"false", message:err});
      }
      if(isValid){
        return next();
      } else {
        req.flash("formData", req.body.user);
        res.redirect("back");
      }
    }
  );
}
// start server
app.listen(3000, function(){
  console.log('Server On!');
});
