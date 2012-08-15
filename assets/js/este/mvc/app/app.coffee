###*
  @fileoverview Este Mvc App.

  todo doc
    how to create app (subclass)
    manages views states
    compile time safe app states transitions
    url routing is optional
    last click win technique
    layout

  WARNING: This is still experimental.
###
goog.provide 'este.mvc.App'

goog.require 'este.Base'
goog.require 'este.mvc.app.Request'

class este.mvc.App extends este.Base

  ###*
    @param {este.mvc.Layout} layout
    @param {Array.<function(new:este.mvc.View)>} views
    @param {este.router.Router} router
    @constructor
    @extends {este.Base}
  ###
  constructor: (@layout, @views, @router) ->
    super

  ###*
    @enum {string}
  ###
  @EventType:
    FETCH: 'fetch'
    FETCHED: 'fetched'

  ###*
    Server side JSON configuration and seed data injected into page.
    @type {Object}
  ###
  data: null

  ###*
    @type {este.mvc.Layout}
    @protected
  ###
  layout: null

  ###*
    @type {Array.<function(new:este.mvc.View)>}
    @protected
  ###
  views: null

  ###*
    @type {este.router.Router}
    @protected
  ###
  router: null

  ###*
    @type {Array.<este.mvc.View>}
    @protected
  ###
  viewsInstances: null

  ###*
    @type {este.mvc.app.Request}
    @protected
  ###
  lastRequest: null

  ###*
    @param {boolean=} silent
  ###
  start: (silent) ->
    @instantiateViews()
    return if silent
    request = new este.mvc.app.Request @viewsInstances[0]
    @showInternal request

  ###*
    @param {function(new:este.mvc.View)} viewClass
    @param {Object=} params
  ###
  show: (viewClass, params) ->
    for instance in @viewsInstances
      if instance instanceof viewClass
        request = new este.mvc.app.Request instance, params
        @showInternal request
        break
    return

  ###*
    @protected
  ###
  instantiateViews: ->
    show = goog.bind @show, @
    @viewsInstances = (for View in @views
      view = new View
      view.show = show
      if view.url
        @router.add view.url, @onViewShow
      view)

  ###*
    @param {goog.events.Event} e
    @protected
  ###
  onViewShow: (e) ->

  ###*
    @param {este.mvc.app.Request} request
    @protected
  ###
  showInternal: (request) ->
    # consider: map params to named args
    @lastRequest = request
    @dispatchEvent App.EventType.FETCH
    request.fetch goog.bind @onViewFetched, @

  ###*
    @param {este.mvc.app.Request} request
    @param {Object} response
    @protected
  ###
  onViewFetched: (request, response) ->
    lastRequest = @lastRequest
    @lastRequest = null if request.equal lastRequest
    return if !request.equal lastRequest
    request.setViewData response
    @switchView request

  ###*
    @param {este.mvc.app.Request} request
    @protected
  ###
  switchView: (request) ->
    @dispatchEvent App.EventType.FETCHED
    @projectUrl request
    @layout.setActive request.view, request.params

  ###*
    @param {este.mvc.app.Request} request
    @protected
  ###
  projectUrl: (request) ->
    return if !request.view.url
    @router.pathNavigate request.view.url, request.params

  ###*
    @inheritDoc
  ###
  disposeInternal: ->
    super
    @lastRequest = null
    return