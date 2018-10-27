const { test } = require('tap')

const { makeClient } = require('../index')

test('parseCommit', async assert => {
  const client = makeClient().build({ entityName: 'foo' })
  const res = await client.parseCommit({ bar: 'baz' })

  assert.deepEquals(res, { bar: 'baz' }, 'returns same event')
})

test('loadEvents', async assert => {
  const eventStore = {
    'foo': [
      { entityId: '123', version: 0, events: [ 'a' ] },
      { entityId: '123', version: 1, events: [ 'b', 'c' ]},
      { entityId: '123', version: 3, events: [ 'd', 'e', 'f' ] },
      { entityId: '123', version: 6, events: [ 'g', 'h', 'i' ] },
    ]
  }
  const expected = [ 'd', 'e', 'f', 'g', 'h', 'i' ]

  const client = makeClient({ eventStore })
    .build({ entityName: 'foo' })
  
  const res = await client.loadEvents('123', 1)

  assert.deepEquals(res, expected, 'returns events after given version')
})

test('listCommits', async assert => {
  const eventStore = {
    'foo': [
      { entityId: '123', commitId: '0', events: [ 'a' ] },
      { entityId: '456', commitId: '1', events: [ 'b' ]},
      { entityId: '789', commitId: '2', events: [ 'c' ] },
      { entityId: '012', commitId: '3', events: [ 'd' ] },
    ]
  }

  const expected = [
    { entityId: '789', commitId: '2', events: [ 'c' ] },
    { entityId: '012', commitId: '3', events: [ 'd' ] },
  ]
  const client = makeClient({ eventStore })
    .build({ entityName: 'foo' })
  
  const res = await client.listCommits({ commitId: '1' })

  assert.deepEquals(res, expected, 'returns commits after given commitId')
})

test('append', async assert => {
  const eventStore = {}
  const client = makeClient({ eventStore })
    .build({ entityName: 'foo' })

  await client.append('123', 0, [ 'a' ])
  const expected1 = [{
    commitId: /\w/,
    committedAt: /\d/,
    entityId: '123',
    entityName: 'foo',
    version: 0,
    events: [ 'a' ],      
  }]

  assert.match(eventStore.foo, expected1, 'appends event to new entityName')
  
  await client.append('456', 1, [ 'b' ])
  
  const expected2 = [
    ...expected1,
    {
      commitId: /\w/,
      committedAt: /\d/,
      entityId: '456',
      entityName: 'foo',
      version: 1,
      events: [ 'b' ],    
    }  
  ]
  assert.match(eventStore.foo, expected2, 'appends event to existing entityName')
})

test('set', async assert => {
  const projectionStore = {}
  const client = makeClient({ projectionStore })
    .build({ entityName: 'foo' })

  

  const expected = {
    foo: {
      '123':{
        id: '123',
        version: 0,
        state: 'foobar',
      }
    }
  }

  await client.set('123', {
    version: 0,
    state: 'foobar',
  })

  assert.deepEquals(projectionStore, expected, 'sets projection in store')
})

test('get', async assert => {
  const projectionStore = {
    foo: {
      '123':{
        id: '123',
        version: 0,
        state: 'foobar',
      }
    }
  }

  const expected = {
    id: '123',
    version: 0,
    state: 'foobar',
  }

  const client = makeClient({ projectionStore })
    .build({ entityName: 'foo' })

 
  const res = await client.get('123')

  assert.deepEquals(res, expected, 'returns exisiting projection from store')
})

test('batchGet', async assert => {
  const projectionStore = {
    foo: {
      '123':{
        id: '123',
        version: 0,
        state: 'foobar',
      },
      '456':{
        id: '456',
        version: 1,
        state: 'barfoo',
      },
      '789':{
        id: '789',
        version: 3,
        state: 'bazbar',
      }
    }
  }

  const expected = [{
    id: '123',
    version: 0,
    state: 'foobar',
  }, {
    id: '789',
    version: 3,
    state: 'bazbar',
  }]

  const client = makeClient({ projectionStore })
    .build({ entityName: 'foo' })

 
  const res = await client.batchGet([ '123', '789', '999' ])

  assert.deepEquals(res, expected, 'returns exisiting projections from store')
})

test('batchWrite', async assert => {
  const projectionStore = {
    foo: {
      '456':{
        id: '456',
        version: 1,
        state: 'barfoo',
      }
    }
  }

  const expected = {
    foo: {
      '123':{
        id: '123',
        version: 0,
        state: 'foobar',
      },
      '456':{
        id: '456',
        version: 1,
        state: 'barfoo',
      },
      '789':{
        id: '789',
        version: 3,
        state: 'bazbar',
      }
    }
  }
  const client = makeClient({ projectionStore })
    .build({ entityName: 'foo' })

 
  const res = await client.batchWrite({
    '123':{
      version: 0,
      state: 'foobar',
    },
    '789':{
      version: 3,
      state: 'bazbar',
    }
  })

  assert.deepEquals(projectionStore, expected, 'updates multiple projections')
})

test('search', async assert => {
  const projectionStore = {
    foo: {
      '123':{
        id: '123',
        version: 0,
        state: {
          foo: 'bar',
          baz: 'foo'
        },
      },
      '456':{
        id: '456',
        version: 1,
        state: {
          foo: 'bar',
          baz: 'foo'
        },
      },
      '789':{
        id: '789',
        version: 3,
        state: {
          foo: 'baz',
          baz: 'foo'
        },
      }
    }
  }

  const expected = [{
    id: '123',
    version: 0,
    state: {
      foo: 'bar',
      baz: 'foo'
    },
  }, {
    id: '456',
    version: 1,
    state: {
      foo: 'bar',
      baz: 'foo'
    },
  }]

  const client = makeClient({ projectionStore })
    .build({ entityName: 'foo' })

 
  const res = await client.search({
    foo: 'bar',
    baz: 'foo',
  })

  assert.deepEquals(res, expected, 'searches projections')
})