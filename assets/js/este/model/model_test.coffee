trimSetter = (value) -> goog.string.trim value || ''
requiredValidator = (value) -> value && goog.string.trim(value).length

class Person extends este.Model

  constructor: (attrs, randomStringGenerator) ->
    super attrs, randomStringGenerator

  schema:
    'firstName':
      'set': trimSetter
      'validators':
        'required': requiredValidator
    'lastName':
      'validators':
        'required': requiredValidator
    'name':
      'meta': (self) -> self.get('firstName') + ' ' + self.get('lastName')
    'age':
      'get': (age) -> Number age

suite 'este.Model', ->

  attrs = null
  person = null

  setup ->
    attrs =
      'firstName': 'Joe'
      'lastName': 'Satriani'
      'age': 55
    idGenerator = -> 1
    person = new Person attrs, idGenerator

  suite 'constructor', ->
    test 'should assign clientId', ->
      assert.equal person.get('clientId'), 1

    test 'should assign id', ->
      person = new Person id: 'foo'
      assert.equal person.get('id'), 'foo'

    test 'should create attributes', ->
      person = new Person
      assert.isUndefined person.get 'firstName'

    test 'should return passed attributes', ->
      assert.strictEqual person.get('firstName'), 'Joe'
      assert.strictEqual person.get('lastName'), 'Satriani'
      assert.strictEqual person.get('age'), 55

  suite 'set and get', ->
    test 'should work for one attribute', ->
      person.set 'age', 35
      assert.strictEqual person.get('age'), 35

    test 'should work for attributes', ->
      person.set 'age': 35, 'firstName': 'Pepa'
      assert.strictEqual person.get('age'), 35
      assert.strictEqual person.get('firstName'), 'Pepa'

  suite 'get', ->
    test 'should accept array and return object', ->
      assert.deepEqual person.get(['age', 'firstName']),
        'age': 55
        'firstName': 'Joe'

  suite 'set', ->
    test 'should set valid keys, ignore invalids', ->
      assert.equal person.get('firstName'), 'Joe'
      person.set
        firstName: 'Pepa'
        lastName: ''
      assert.equal person.get('firstName'), 'Pepa'
      assert.equal person.get('lastName'), 'Satriani'

  suite 'toJson', ->
    suite 'without attrs', ->
      test 'true should not return meta name nor clientId', ->
        person = new Person
        json = person.toJson true
        assert.isUndefined json.clientId
        assert.isUndefined json.name

      test 'false should return clientId and meta name', ->
        person = new Person null, -> 1
        json = person.toJson()
        assert.deepEqual json,
          'clientId': 1
          'name': 'undefined undefined'

    suite 'with attrs', ->
      test 'false should return clientId and meta name', ->
        json = person.toJson()
        assert.deepEqual json,
          'clientId': 1
          'firstName': 'Joe'
          'lastName': 'Satriani'
          'name': 'Joe Satriani'
          'age': 55

  suite 'has', ->
    test 'should work', ->
      assert.isTrue person.has 'age'
      assert.isFalse person.has 'fooBlaBlaFoo'

    test 'should work even for keys which are defined on Object.prototype.', ->
      assert.isFalse person.has 'toString'
      assert.isFalse person.has 'constructor'
      assert.isFalse person.has '__proto__'
      # etc. from Object.prototype

  suite 'remove', ->
    test 'should work', ->
      assert.isFalse person.has 'fok'
      assert.isFalse person.remove 'fok'

      assert.isTrue person.has 'age'
      assert.isTrue person.remove 'age'
      assert.isFalse person.has 'age'

    test 'should call setParentEventTarget null on removed EventTargets', ->
      target = new goog.events.EventTarget
      person.set 'foo', target
      person.remove 'foo'
      assert.isNull target.getParentEventTarget()

  suite 'schema', ->
    suite 'set', ->
      test 'should work as formater before set', ->
        person.set 'firstName', '  whitespaces '
        assert.equal person.get('firstName'), 'whitespaces'

    suite 'get', ->
      test 'should work as formater after get', ->
        person.set 'age', '1d23'
        assert.isNumber person.get 'age'

  suite 'change event', ->
    test 'should be dispached if value change', (done) ->
      goog.events.listenOnce person, 'change', (e) ->
        assert.deepEqual e.changed,
          age: 'foo'
        done()
      person.set 'age', 'foo'

    test 'should not be dispached if value hasnt changed', ->
      called = false
      goog.events.listenOnce person, 'change', (e) ->
        called = true
      person.set 'age', 55
      assert.isFalse called

    test 'should be dispached if value is removed', ->
      called = false
      goog.events.listenOnce person, 'change', (e) ->
        called = true
      person.remove 'age'
      assert.isTrue called

  suite 'meta', ->
    test 'should define meta attribute', ->
      assert.equal person.get('name'), 'Joe Satriani'

  suite 'bubbling events', ->
    test 'from inner model should work', ->
      called = 0
      innerModel = new Person
      person.set 'inner', innerModel
      goog.events.listen person, 'change', (e) ->
        called++
      innerModel.set 'name', 'foo'
      person.remove 'inner', innerModel
      innerModel.set 'name', 'foo'
      assert.equal called, 2

  suite 'errors', ->
    suite 'set', ->
      test 'should return correct errors', ->
        errors = person.set()
        assert.isNull errors

        errors = person.set 'firstName', null
        assert.deepEqual errors,
          firstName: required: true
        assert.equal person.get('firstName'), 'Joe'

        errors = person.set 'firstName', 'Pepa'
        assert.deepEqual errors, null

        errors = person.set 'firstName': 'Pepa', 'lastName': 'Zdepa'
        assert.deepEqual errors, null

        errors = person.set 'firstName': null, 'lastName': null
        assert.deepEqual errors,
          firstName: required: true
          lastName: required: true

    suite 'validate', ->
      test 'should return correct errors', ->
        errors = person.validate()
        assert.isNull errors

        person = new Person
        errors = person.validate()
        assert.deepEqual errors,
          firstName:
            required: true
          lastName:
            required: true

        person.set 'firstName', 'Pepa'

        errors = person.validate()
        assert.deepEqual errors,
          lastName: required: true