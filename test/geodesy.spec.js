import geodesy from '../src/index';

describe( 'intercept', function() {
  it( 'should return the correct coordinate', function() {
    const istanbul = [ 29.0121795, 41.0053215 ];
    const washington = [ -77.0145665, 38.8993488 ];
    const reykjavik = [ -21.8524424, 64.132442 ];
    const intersection = geodesy.intercept( reykjavik, [ istanbul, washington ] );
    expect( intersection ).to.eql([ -21.983148259557282, 54.38603968291745 ]);
  });
});
