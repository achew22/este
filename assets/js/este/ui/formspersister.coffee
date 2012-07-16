###*
  @fileoverview Forms persister. Persist form fields state into localStorage
  or session.

  note
    not tested in IE, but it should work in IE>8 and be easily fixable for rest
  
  todo
    add expiration!
    improve field dom path (consider: url, form name, etc.)
    check&fix IE (http://stackoverflow.com/a/266252/233902)
###

goog.provide 'este.ui.FormsPersister'
goog.provide 'este.ui.FormsPersister.create'

goog.require 'goog.ui.Component'
goog.require 'goog.dom.forms'
goog.require 'este.dom'
goog.require 'goog.events.FocusHandler'
goog.require 'goog.events.InputHandler'
goog.require 'este.storage.create'

###*
  @param {boolean=} session
  @constructor
  @extends {goog.ui.Component}
###
este.ui.FormsPersister = (session = false) ->
  goog.base @
  @storage = este.storage.createCollectable 'este-ui-formspersister', session
  return

goog.inherits este.ui.FormsPersister, goog.ui.Component

goog.scope ->
  `var _ = este.ui.FormsPersister`
  `var forms = goog.dom.forms`

  ###*
    @param {Element} element
    @param {boolean=} session
    @return {este.ui.FormsPersister}
  ###
  _.create = (element, session) ->
    persist = new este.ui.FormsPersister session
    persist.decorate element
    persist

  ###*
    Minimal client storage ftw.
    @type {number}
  ###
  _::expirationTime = 1000 * 60 * 60 * 24 * 30

  ###*
    @type {goog.storage.CollectableStorage}
    @protected
  ###
  _::storage

  ###*
    @type {goog.events.FocusHandler}
    @protected
  ###
  _::focusHandler

  ###*
    @override
  ###
  _::decorateInternal = (element) ->
    goog.base @, 'decorateInternal', element
    path = @getElementDomPath()
    data = @storage.get path.join()
    return if !data
    `data = /** @type {Object} */ (data)`
    @retrieve data
    return

  ###*
    @param {Object} data
    @protected
  ###
  _::retrieve = (data) ->
    for formPath, fields of data
      form = este.dom.getElementByDomPathIndex formPath.split ','
      continue if !form || !form.elements

      fieldsMap = {}
      for el in form.elements
        fieldsMap[el.name] ?= []
        fieldsMap[el.name].push el

      for name, value of fields
        field = fieldsMap[name]?[0]
        continue if !field
        
        switch field.type
          when 'radio'
            for el in fieldsMap[name]
              forms.setValue el, el.value == value
          when 'checkbox'
            for el in fieldsMap[name]
              forms.setValue el, goog.array.contains value, el.value
          else
            forms.setValue field, value
    return

  ###*
    @override
  ###
  _::enterDocument = ->
    goog.base @, 'enterDocument'
    @focusHandler = new goog.events.FocusHandler @getElement()
    @getHandler().
      listen(@focusHandler, 'focusin', @onFocusin).
      listen(@getElement(), 'change', @onChange)
    return

  ###*
    @override
  ###
  _::exitDocument = ->
    @focusHandler.dispose()
    goog.base @, 'exitDocument'
    return

  ###*
    @param {goog.events.BrowserEvent} e
    @protected
  ###
  _::onFocusin = (e) ->
    `var target = /** @type {Element} */ (e.target)`
    return if !(target.tagName in ['INPUT', 'TEXTAREA'])
    @registerInputHander target

  ###*
    @param {Element} field
    @protected
  ###
  _::registerInputHander = (field) ->
    handler = new goog.events.InputHandler field
    @getHandler().listen handler, 'input', @onFieldInput
    @getHandler().listenOnce field, 'blur', (e) ->
      handler.dispose()

  ###*
    @param {goog.events.BrowserEvent} e
    @protected
  ###
  _::onFieldInput = (e) ->
    `var target = /** @type {Element} */ (e.target)`
    @storeField target

  ###*
    @param {goog.events.BrowserEvent} e
    @protected
  ###
  _::onChange = (e) ->
    `var target = /** @type {Element} */ (e.target)`
    @storeField target

  ###*
    @param {Element} field
    @protected
  ###
  _::storeField = (field) ->
    formDomPath = este.dom.getDomPathIndexes field.form
    name = field.name
    value = @getFieldValue field
    @store formDomPath, name, value

  ###*
    @param {Array.<number>} formDomPath
    @param {string} name
    @param {string|Array.<string>} value
  ###
  _::store = (formDomPath, name, value) ->
    path = @getElementDomPath()
    key = path.join()
    storage = @storage.get key
    storage ?= {}
    storage[formDomPath] ?= {}
    storage[formDomPath][name] = value
    @storage.set key, storage, goog.now() + @expirationTime

  ###*
    @return {Array.<number>}
    @protected
  ###
  _::getElementDomPath = ->
    este.dom.getDomPathIndexes @getElement()

  ###*
    @param {Element} field
    @return {string|Array.<string>}
    @protected
  ###
  _::getFieldValue = (field) ->
    if field.type == 'checkbox'
      values = []
      for el in field.form.elements when el.name == field.name
        value = forms.getValue el
        values.push value if value?
      return values
    forms.getValue field

  return