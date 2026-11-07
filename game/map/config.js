(function (root, factory) {
  var config = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = config;
  else root.CatMapConfig = config;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return {
    demolitionRefundRatio: 0.5,
    defaultTileCapacity: 10,
    districtCapacities: {
      agriculture: 10, housing: 10, forestry: 10, mining: 10,
      science: 10, religion: 10, industry: 10, port: 10
    }
  };
}));
