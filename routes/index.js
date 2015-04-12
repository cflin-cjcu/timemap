var _ = require('underscore')
  , wmts = require('leaflet-tw').wmts()
  , config = require('../lib/config.js')
  , dao = require('../lib/dao.js')
  , logic = require('../lib/logic')
  , util = require('../lib/util.js')
  ;

exports.create = function(req, res) {
  // just a stub for form
  var dataview = {
    tmconfig: {
      // default
      viewtype: 'timemap'
    }
  };
  wmts.avaliableTitles(
    'http://gis.sinica.edu.tw/tainan//1.0.0/WMTSCapabilities.xml',
    function(err, result){
      if(!err)
        dataview.titles = result.titles;
      res.render('dataview/create.html', {
        title: 'Create',
        dataview: dataview
      });
    }
  );
}

exports.createPost = function(req, res) {
  var data = req.body;
  logic.createDataView(data, req.user, function(err, out) {
    var out = out.toJSON();
    if (err) {
      res.send(err.code, err.message);
    } else {
      // req.flash('Data View Created');
      res.redirect(urlFor(out.owner, out.name));
    }
  });
}

function urlFor(owner, dataView) {
  return '/' + [
    owner,
    dataView
    ].join('/')
}

exports.preview = function(req, res) {
  var threadData = {
    name: 'whatever-you-want',
    title: req.query.title || 'Untitled',
    owner: req.query.owner || 'Anonymous',
    resources: [
      {
        url: req.query.url,
        backend: 'gdocs'
      }
    ],
    tmconfig: {
      dayfirst: req.query.dayfirst,
      startfrom: req.query.startfrom,
      viewtype: req.query.viewtype || 'timemap'
    }
  };
  var isOwner = false;
  res.render('dataview/timemap.html', {
      title: threadData.title
    , embed: (req.query.embed !== undefined)
    , viz: threadData
    , vizJSON: JSON.stringify(threadData)
    , isOwner: isOwner
  });
}

// ======================================
// User Pages and Dashboards
// ======================================

exports.dashboard = function(req, res) {
  var userId = req.user.id;
  getUserInfoFull(req.user.id, function(error, account) {
    if (error) {
      res.send('Not found', 404);
      return;
    }
    res.render('dashboard.html', {
      account: account.toJSON(),
      views: account.views
    });
  });
};

exports.userShow = function(req, res) {
  var userId = req.params.userId;
  var account = dao.Account.create({id: userId});
  getUserInfoFull(userId, function(error, account) {
    if (error) {
      res.send('Not found', 404);
      return;
    }
    var isOwner = (req.currentUser && req.currentUser.id == userId);
    var accountJson = account.toTemplateJSON();
    accountJson.createdNice = new Date(accountJson._created).toDateString();
    res.render('account/view.html', {
        account: accountJson
      , views: account.views
      , isOwner: isOwner
      , bodyclass: 'account'
    });
  });
};

function getUserInfoFull(userId, cb) {
  var account = dao.Account.create({id: userId});
  account.fetch(function(error) {
    if (error) {
      cb(error);
      return;
    }
    dao.DataView.getByOwner(userId, function(error, views) {
      account.views = views;
      cb(error, account);
    });
  });
}

// ======================================
// Data Views
// ======================================

var routePrefixes = {
    'js': ''
  , 'css': ''
  , 'vendor': ''
  , 'img': ''
  , 'account': ''
  , 'dashboard': ''
};

exports.listall = function(req, res){
  dao.DataView.List(function(error, views){
    if(error)
      res.send(500);
    else 
      res.render('listall.html', {views:views});
  });
}

exports.timeMap = function(req, res, next) {
  var userId = req.params.userId;
  // HACK: we only want to handle threads and not other stuff
  if (userId in routePrefixes) {
    next();
    return;
  }
  var threadName = req.params.threadName;
  var viz = dao.DataView.create({owner: userId, name: threadName});
  viz.fetch(function(error) {
    if (error) {
      res.send('Not found ' + error.message, 404);
      return;
    }
    var threadData = viz.toTemplateJSON();
    var isOwner = (req.user && req.user.id == threadData.owner);
    res.render('dataview/timemap.html', {
        title: threadData.title
      , permalink: 'http://timemap.kuansim.com/' + threadData.owner + '/' + threadData.name
      , authorLink: 'http://timemap.kuansim.com/' + threadData.owner
      , embed: (req.query.embed !== undefined)
      , viz: threadData
      , vizJSON: JSON.stringify(threadData)
      , isOwner: isOwner
    });
  });
}

exports.dataViewEdit = function(req, res) {
  var userId = req.params.userId;
  var threadName = req.params.threadName;
  var viz = dao.DataView.create({owner: userId, name: threadName});
  viz.fetch(function(error) {
    if (error) {
      res.send('Not found ' + error.message, 404);
      return;
    }
    var dataview = viz.toTemplateJSON();
    wmts.avaliableTitles(
      'http://gis.sinica.edu.tw/tainan//1.0.0/WMTSCapabilities.xml', 
      function(err, result){
        dataview.titles = result.titles;
        res.render('dataview/edit.html', {
            dataview: dataview
          , dataviewJson: JSON.stringify(viz.toJSON())
      });
    });
  });
}

exports.dataViewEditPost = function(req, res) {
  var userId = req.params.userId
    , threadName = req.params.threadName
    , data = req.body
    ;
  var viz = dao.DataView.create({owner: userId, name: threadName});
  viz.fetch(function(error) {
    var dataViewData = viz.toJSON();
    var vizData = _.extend(dataViewData, {
      title: data.title,
      resources: [
        _.extend({}, dataViewData.resources[0], {
          url: data.url
        })
      ],
      tmconfig: _.extend({}, dataViewData.tmconfig, data.tmconfig)
    });
    // RECREATE as create does casting correctly
    newviz = dao.DataView.create(dataViewData);
    logic.upsertDataView(newviz, 'update', req.user, function(err, out) {
      var out = out.toJSON();
      if (err) {
        res.send(err.code, err.message);
      } else {
        // req.flash('Data View Updated');
        res.redirect(urlFor(out.owner, out.name));
      }
    });
  });
}
