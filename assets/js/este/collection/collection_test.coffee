suite 'este.Collection', ->

  # todo: sort compare tests

  Collection = este.Collection
  Model = este.Model
  Child = null
  collection = null

  setup ->
    collection = new Collection

  arrangeChildType = ->
    Child = ->
      Model.apply @, arguments
    goog.inherits Child, Model
    Child::schema =
      c: meta: ->
        'fok'

  arrangeCollectionWithItems = ->
    collection.add 'a': 1, 'aa': 1.5
    collection.add 'b': 2, 'bb': 2.5
    collection.add 'c': 3, 'cc': 3.5

  suite 'constructor', ->
    test 'should optionally allow inject json data', ->
      json = [
        a: 1
      ,
        b: 2
      ]
      collection = new Collection json
      assert.deepEqual collection.toJson(), json

    test 'should allow to override model', ->
      model = ->
      collection = new Collection null, model
      collection.add {}
      assert.instanceOf collection.at(0), model

  suite 'model property', ->
    test 'should wrap json (meta test included)', ->
      arrangeChildType()
      json = [
        a: 1
      ,
        b: 2
      ]
      collection = new Collection json, Child
      assert.instanceOf collection.at(0), Child
      assert.equal collection.at(0).get('a'), 1
      assert.equal collection.at(1).get('b'), 2
      assert.equal collection.at(0).get('c'), 'fok'

    test 'should dispatch add event with models, not jsons', (done) ->
      collection = new Collection null, Model
      goog.events.listenOnce collection, 'add', (e) ->
        assert.instanceOf e.added[0], Model
        done()
      collection.add a: 1

    test 'toJson should serialize model', ->
      arrangeChildType()
      json = [
        id: 0
        a: 'aa'
      ,
        id: 1
        b: 'bb'
      ]
      collection = new Collection json, Child
      collectionJson = collection.toJson()
      delete cJson._cid for cJson in collectionJson
      assert.deepEqual collectionJson, [
        id: 0
        a: 'aa'
        c: 'fok'
      ,
        id: 1
        b: 'bb'
        c: 'fok'
      ]

  suite 'add, remove and getLength', ->
    test 'should work', ->
      assert.equal collection.getLength(), 0
      collection.add 1
      assert.equal collection.getLength(), 1
      assert.isFalse collection.remove 2
      assert.isTrue collection.remove 1
      assert.equal collection.getLength(), 0

  suite 'add item', ->
    test 'should fire add event', ->
      addCalled = false
      added = null
      goog.events.listenOnce collection, 'add', (e) ->
        added = e.added
        addCalled = true
      collection.add 1
      assert.isTrue addCalled
      assert.deepEqual added, [1]

    test 'should fire update event', (done) ->
      goog.events.listenOnce collection, 'update', (e) ->
        done()
      collection.add 1

    test 'should throw exception for model item with same id', ->
      called = false
      arrangeChildType()
      collection = new Collection [], Child
      collection.add id: 1
      try
        collection.add id: 1
      catch e
        called = true
      assert.isTrue called

    test 'should not throw exception for model item with same id if item was removed', ->
      called = false
      arrangeChildType()
      collection = new Collection [], Child
      collection.add id: 1
      collection.remove collection.at 0
      try
        collection.add id: 1
      catch e
        called = true
      assert.isFalse called

  suite 'add items', ->
    test 'should fire add event', ->
      addCalled = false
      added = null
      goog.events.listenOnce collection, 'add', (e) ->
        added = e.added
        addCalled = true
      collection.add [1, 2]
      assert.isTrue addCalled
      assert.deepEqual added, [1, 2]

  suite 'remove item', ->
    test 'should fire remove event', ->
      removeCalled = false
      removed = null
      collection.add 1
      goog.events.listen collection, 'remove', (e) ->
        removed = e.removed
        removeCalled = true
      collection.remove 1
      assert.isTrue removeCalled, 'removeCalled'
      assert.deepEqual removed, [1]

    test 'should fire update event', (done) ->
      collection.add 1
      goog.events.listenOnce collection, 'update', (e) ->
        done()
      collection.remove 1

    test 'should not fire remove event', ->
      removeCalled = false
      goog.events.listen collection, 'remove', -> removeCalled = true
      collection.remove 1
      assert.isFalse removeCalled

  suite 'remove item', ->
    test 'should fire remove event', ->
      removeCalled = false
      removed = null
      collection.add 1
      goog.events.listen collection, 'remove', (e) ->
        removed = e.removed
        removeCalled = true
      collection.remove [1]
      assert.isTrue removeCalled, 'removeCalled'
      assert.deepEqual removed, [1]

    test 'should not fire remove, change events', ->
      removeCalled = changeCalled = false
      goog.events.listen collection, 'remove', -> removeCalled = true
      goog.events.listen collection, 'change', -> changeCalled = true
      collection.remove 1
      assert.isFalse removeCalled
      assert.isFalse changeCalled

  suite 'contains', ->
    test 'should return true if obj is present', ->
      assert.isFalse collection.contains 1
      collection.add 1
      assert.isTrue collection.contains 1

  suite 'removeIf', ->
    test 'should remove item', ->
      collection.add 1
      assert.isTrue collection.contains 1
      collection.removeIf (item) -> item == 1
      assert.isFalse collection.contains 1

  suite 'at', ->
    test 'should return item by index', ->
      collection.add 1
      assert.equal collection.at(0), 1

  suite 'toArray', ->
    test 'should return inner array', ->
      collection.add 1
      assert.deepEqual collection.toArray(), [1]

  suite 'toJson', ->
    test 'should return inner array', ->
      collection.add 1
      assert.deepEqual collection.toJson(), [1]

    test 'should pass noMetas to model toJson method', (done) ->
      collection = new Collection null, Model
      collection.add 'a': 1
      collection.at(0).toJson = (noMetas) ->
        assert.isTrue noMetas
        done()
      collection.toJson true

  suite 'bubbling events', ->
    test 'from inner model should work', ->
      called = 0
      innerModel = new Model
      collection.add innerModel
      goog.events.listen collection, 'change', (e) ->
        called++
      innerModel.set '1', 1
      assert.equal called, 1
      collection.remove innerModel
      assert.equal called, 1
      innerModel.set '1', 2
      assert.equal called, 1

    test 'from inner model (within other collection) should work', ->
      called = 0
      innerModel = new Model
      collection.add innerModel
      collection2 = new Collection
      collection2.add innerModel
      goog.events.listen collection, 'change', (e) ->
        called++
      innerModel.set '1', 1
      assert.equal called, 1
      collection.remove innerModel
      assert.equal called, 1
      innerModel.set '1', 2
      assert.equal called, 1

  suite 'find', ->
    test 'should find item', ->
      collection.add [
        a: 1
      ,
        b: 2
      ]
      found = collection.find (item) -> item.a == 1
      assert.deepEqual found, a: 1
      found = collection.find (item) -> item.b == 2
      assert.deepEqual found, b: 2
      found = collection.find (item) -> item.b == 3
      assert.isUndefined found

  suite 'findById', ->
    test 'should find item by id', ->
      collection.add [
        id: 1
      ,
        id: 2
      ]
      found = collection.findById 1
      assert.deepEqual found, id: 1
      found = collection.findById 2
      assert.deepEqual found, id: 2
      found = collection.findById 3
      assert.isUndefined found

    test 'should find typed item by id', ->
      arrangeChildType()
      Child::schema = {}
      json = [
        id: 1
      ,
        id: 2
      ]

      collection = new Collection json, Child
      found = collection.findById 1
      json = found.toJson()
      delete json._cid
      assert.deepEqual json, id: 1

      found = collection.findById 2
      json = found.toJson()
      delete json._cid
      assert.deepEqual json, id: 2

      found = collection.findById 3
      assert.isUndefined found

  suite 'findByClientId', ->
    test 'should find item by _cid', ->
      collection.add [
        id: 1, _cid: ':1'
      ,
        id: 2, _cid: ':2'
      ]
      found = collection.findByClientId ':1'
      assert.deepEqual found, id: 1, _cid: ':1'
      found = collection.findByClientId ':2'
      assert.deepEqual found, id: 2, _cid: ':2'
      found = collection.findByClientId ':3'
      assert.isUndefined found

    test 'should find typed item by _cid', ->
      arrangeChildType()
      Child::schema = {}
      json = [
        id: 1, _cid: ':1'
      ,
        id: 2, _cid: ':2'
      ]

      collection = new Collection json, Child
      found = collection.findByClientId ':1'
      json = found.toJson()
      delete json._cid
      assert.deepEqual json, id: 1

      found = collection.findByClientId ':2'
      json = found.toJson()
      delete json._cid
      assert.deepEqual json, id: 2

      found = collection.findByClientId ':3'
      assert.isUndefined found

  suite 'add typed object into typed collection', ->
    test 'should work', ->
      arrangeChildType()
      collection = new Collection [], Child
      child = new Child
      child.set 'a', 1
      collection.add child
      assert.instanceOf collection.at(0), Child
      assert.equal collection.at(0).get('a'), 1

  suite 'clear', ->
    test 'should works', ->
      count = 0
      collection = new Collection
      collection.add 1
      collection.add 2
      goog.events.listenOnce collection, 'remove', -> count++
      collection.clear()
      assert.equal count, 1
      assert.isUndefined collection.at 0
      assert.isUndefined collection.at 1

  suite 'sorting', ->
    suite 'default compare', ->
      test 'should preserve order of numbers', ->
        collection.add [3, 2, 1]
        assert.deepEqual collection.toJson(), [3, 2, 1]

      test 'should preserve order of string', ->
        collection.add ['c', 'b', 'a']
        assert.deepEqual collection.toJson(), ['c', 'b', 'a']
        collection.remove 'a'
        assert.deepEqual collection.toJson(), ['c', 'b']

    suite 'sort', ->
      test 'should fire sort event', (done) ->
        goog.events.listenOnce collection, 'sort', (e) ->
          done()
        collection.sort()

      test 'should fire update event', (done) ->
        goog.events.listenOnce collection, 'update', (e) ->
          done()
        collection.sort()

      suite 'by', ->
        test 'before should work', ->
          collection.sort
            compare: goog.array.defaultCompare
            by: (item) -> item.id
          collection.add id: 3
          collection.add id: 2
          collection.add id: 1
          assert.deepEqual collection.toJson(), [{id: 1}, {id: 2}, {id: 3}]

        test 'after should work', ->
          collection.add id: 1
          collection.add id: 2
          collection.add id: 3
          collection.sort by: (item) -> item.id
          assert.deepEqual collection.toJson(), [{id: 1}, {id: 2}, {id: 3}]

      # todo
      # suite 'compare', ->

      suite 'reversed', ->
        test 'before should work', ->
          collection.sort
            compare: goog.array.defaultCompare
            by: (item) -> item.id
            reversed: true
          collection.add id: 3
          collection.add id: 1
          collection.add id: 2
          assert.deepEqual collection.toJson(), [{id: 3}, {id: 2}, {id: 1}]

        test 'after should work', ->
          collection.add id: 'c'
          collection.add id: 'a'
          collection.add id: 'b'
          collection.sort
            compare: goog.array.defaultCompare
            by: (item) -> item.id
            reversed: true
          assert.deepEqual collection.toJson(), [{id: 'c'}, {id: 'b'}, {id: 'a'}]

  suite 'subclassed collection', ->
    test 'should allow to define model as property', ->
      ChildCollection = (array, model) ->
        goog.base @, array, model
        return
      goog.inherits ChildCollection, Collection
      ChildCollection::model = Child
      collection = new ChildCollection
      assert.equal collection.model, Child

  suite 'filter', ->
    suite 'on collection with jsons', ->
      setup ->
        arrangeCollectionWithItems()

      test 'should filter by function', ->
        filtered = collection.filter (item) ->
          item['a'] == 1
        assert.deepEqual filtered, [
          'a': 1, 'aa': 1.5
        ]

        filtered = collection.filter (item) ->
          item['a'] == 2
        assert.deepEqual filtered, []

        filtered = collection.filter (item) ->
          item['a'] == 1 || item['bb'] == 2.5
        assert.deepEqual filtered, [
          'a': 1, 'aa': 1.5
        ,
          'b': 2, 'bb': 2.5
        ]

      test 'should filter by object', ->
        filtered = collection.filter 'a': 1
        assert.deepEqual filtered, [
          'a': 1, 'aa': 1.5
        ]

        filtered = collection.filter 'a': 2
        assert.deepEqual filtered, []

        filtered = collection.filter 'bb': 2.5
        assert.deepEqual filtered, [
          'b': 2, 'bb': 2.5
        ]

    suite 'on collection with models', ->
      setup ->
        collection = new Collection null, Model
        arrangeCollectionWithItems()

      test 'should filter by function', ->
        filtered = collection.filter (item) ->
          item['a'] == 1
        delete filtered[0]['_cid']
        assert.deepEqual filtered, [
          'a': 1, 'aa': 1.5
        ]

        filtered = collection.filter (item) ->
          item['a'] == 2
        assert.deepEqual filtered, []

        filtered = collection.filter (item) ->
          item['a'] == 1 || item['bb'] == 2.5
        delete filtered[0]['_cid']
        delete filtered[1]['_cid']
        assert.deepEqual filtered, [
          'a': 1, 'aa': 1.5
        ,
          'b': 2, 'bb': 2.5
        ]

      test 'should filter by object', ->
        filtered = collection.filter 'a': 1
        delete filtered[0]['_cid']
        assert.deepEqual filtered, [
          'a': 1, 'aa': 1.5
        ]

        filtered = collection.filter 'a': 2
        assert.deepEqual filtered, []

        filtered = collection.filter 'bb': 2.5
        delete filtered[0]['_cid']
        assert.deepEqual filtered, [
          'b': 2, 'bb': 2.5
        ]

  suite 'each', ->
    test 'should call passed callback with each collection item', ->
      arrangeCollectionWithItems()
      items = []
      collection.each (item) ->
        items.push item
      assert.deepEqual items, [
        'a': 1, 'aa': 1.5
      ,
        'b': 2, 'bb': 2.5
      ,
        'c': 3, 'cc': 3.5
      ]

    test 'should call passed callback with each collection model', ->
      collection = new Collection null, Model
      arrangeCollectionWithItems()
      items = []
      collection.each (item) ->
        item.remove '_cid'
        items.push item.toJson()
      assert.deepEqual JSON.stringify(items), JSON.stringify([
        'a': 1, 'aa': 1.5
      ,
        'b': 2, 'bb': 2.5
      ,
        'c': 3, 'cc': 3.5
      ])

  suite 'multiple parent event propagation', ->
    test 'should work', ->
      collection1 = new Collection
      collection2 = new Collection
      model = new Model
      collection1.add model
      collection2.add model

      calls = ''
      goog.events.listen collection1, 'change', ->
        calls += 'col1called'
      goog.events.listen collection2, 'change', ->
        calls += 'col2called'
      model.set 'foo', 'bla'
      assert.equal calls, 'col1calledcol2called'

      calls = ''
      goog.events.listen collection1, 'update', ->
        calls += 'col1called'
      goog.events.listen collection2, 'update', ->
        calls += 'col2called'
      model.set 'foo', 'fok'
      assert.equal calls, 'col1calledcol2calledcol1calledcol2called'