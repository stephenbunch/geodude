import GeographicLib from './GeographicLib';

export default {
  distanceToPoint,
  distanceToLine,
  intercept,
  destinationPoint,
  initialBearing
}

// See this forum post for more info on geodesics:
// http://sourceforge.net/p/geographiclib/discussion/1026621/thread/21aaff9f/#8a93


/**
 * An array of two numbers: [longitude, latitude]
 * @typedef {Array.<Number>} Coordinate
 */

/**
 * An array of two coordinates: [origin, destination]
 * @typedef {Array.<Coordinate>} Line
 */

/**
 * An array of four numbers: [ minX, minY, maxX, maxY ]
 * @typedef {Array.<Number>} BBox
 */

/**
 * An array of two numbers: [ x, y ]
 * @typedef {Array.<Number>} Point
 */


/**
 * @param {Coordinate} origin
 * @param {Coordinate} destination
 * @returns {Number} Distance in meters.
 */
function distanceToPoint( origin, destination ) {
  return GeographicLib.Geodesic.WGS84.GenInverse(
    origin[1], origin[0],
    destination[1], destination[0],
    GeographicLib.Geodesic.DISTANCE
  ).s12;
}

/**
 * @param {Coordinate} point
 * @param {Line} line
 * @returns {Number} Distance in meters.
 */
function distanceToLine( point, line ) {
  return distanceToPoint( point, intercept( point, line ) );
}

/**
 * Gets the intersection point between the specified line and the perpendicular
 * line that runs through the specified point.
 * @param {Coordinate} point
 * @param {Line} line
 * @returns {Coordinate}
 */
function intercept( point, line ) {
 var A1 = line[0];
 var A2 = line[1];
 var B1 = point;
 var B2 = [ ( A1[ 0 ] + A2[ 0 ] ) / 2, ( A1[ 1 ] + A2[ 1 ] ) / 2 ];
 var results = [];
 while ( true ) {
   var a1 = gnForward( B2, A1 );
   var a2 = gnForward( B2, A2 );
   var b1 = gnForward( B2, B1 );

   var b2 = intersect( [ a1, a2 ], b1 );
   var nB2 = gnReverse( B2, b2 );

   if ( isNaN( nB2[0] ) || isNaN( nB2[1] ) ) {
     return nB2;
   }

   var dB2 = [ nB2[0] - B2[0], nB2[1] - B2[1] ];
   B2 = nB2;

   if ( dB2[0] < 0.0000000000000001 && dB2[1] < 0.0000000000000001 ) {
     break;
   }

   // There's an issue where this algorithm alternates between two different
   // results indefinitely, the difference of which is big enough to pass
   // the check above. If we hit a result that we've seen before, exit.
   var key = B2[0] + ',' + B2[1];
   if ( results.indexOf( key ) === -1 ) {
     results.push( key );
   } else {
     break;
   }
 }
 return B2;
}

/**
 * @param {Coordinate} origin The starting point.
 * @param {Number} azi Direction in degrees. 0 deg -> north, 90 deg -> east, etc.
 * @param {Number} distance Distance in meters.
 * @returns {Coordinate}
 */
function destinationPoint( origin, azi, distance ) {
  var result = GeographicLib.Geodesic.WGS84.GenDirect(
    origin[1],
    origin[0],
    azi,
    false,
    distance,
    GeographicLib.Geodesic.LATITUDE | GeographicLib.Geodesic.LONGITUDE
  );
  return [ result.lon2, result.lat2 ];
}

function initialBearing( origin, destination ) {
  var result = GeographicLib.Geodesic.WGS84.GenInverse(
    origin[1],
    origin[0],
    destination[1],
    destination[0],
    GeographicLib.Geodesic.AZIMUTH
  );
  return result.azi2;
}

function inRange( value, range ) {
  if ( range[1] > range[0] ) {
    return value >= range[0] && value <= range[1];
  } else {
    return value >= range[1] && value <= range[0];
  }
}

function nearest( value, values ) {
  return values.sort( function( a, b ) {
    var dA = Math.abs( a - value );
    var dB = Math.abs( b - value );
    return dA > dB ? 1 : dA < dB ? -1 : 0;
  })[0];
}

/**
 * Find the intersection point of the line that runs perpendicular
 * to the vector and through the specified point.
 * @param {Vector} v
 * @param {Point} p
 * Vector -> [Point, Point]
 * Point  -> [x, y]
 * @return {Point}
 */
function intersect( v, p ) {
    // A line has the format:
    // y = mx + b
    // m = 𝚫y / 𝚫x

    // Find the equation for the line `v`.
    var p1 = v[0];
    var p2 = v[1];
    var x, y;

    if ( p1[1] === p2[1] ) {
      // If the line is horizontal, the distance is the difference between
      // the Y values.
      x = p[0];
      y = p1[1];

    } else if ( p1[0] === p2[0] ) {
      // If the line is vertical, the distance is the difference between
      // the X values.
      x = p1[0];
      y = p[1];

    } else {
      var m = ( p2[1] - p1[1] ) / ( p2[0] - p1[0] );
      var b = p1[1] - m * p1[0];

      // Find the line perpendicular to `v`.
      // The slope of the perpendicular line is going to be the
      // negative inverse of the slope for `v`.
      var m2 = -1 / m;
      var b2 = p[1] - m2 * p[0];

      // Figure out where the two lines intersect.
      // Solve for x:
      // mx + b = m2x + b2
      // mx - m2x = b2 - b
      // x(m - m2) = b2 - b
      // x = (b2 - b) / (m - m2)
      x = ( b2 - b ) / ( m - m2 );
      y = m * x + b;
    }

    // If any coordinate is out of range, use the nearest coordinate on the line.
    if ( !inRange( x, [ p1[0], p2[0] ] ) ) {
      x = nearest( x, [ p1[0], p2[0] ] );
    }

    if ( !inRange( y, [ p1[1], p2[1] ] ) ) {
      y = nearest( y, [ p1[1], p2[1] ] );
    }

    return [ x, y ];
}

// Gnomonic projection cpp port.
// http://geographiclib.sourceforge.net/html/Gnomonic_8cpp_source.html

/**
 * @param {Coordinate} center
 * @param {Coordinate} coord
 * @returns {Point}
 */
function gnForward( center, coord ) {
  var result = GeographicLib.Geodesic.WGS84.GenInverse(
    center[1], center[0],
    coord[1], coord[0],
    GeographicLib.Geodesic.AZIMUTH | GeographicLib.Geodesic.REDUCEDLENGTH |
    GeographicLib.Geodesic.GEODESICSCALE
  );
  var x, y;
  if ( result.M12 <= 0 ) {
    x = y = NaN;
  } else {
    var rho = result.m12 / result.M12;
    var azi0 = result.azi1 * GeographicLib.Math.degree;
    x = rho * Math.sin( azi0 );
    y = rho * Math.cos( azi0 );
  }
  return [ x, y ];
}

/**
 * @param {Coordinate} center
 * @param {Point} point
 * @returns {Coordinate}
 */
function gnReverse( center, point ) {
  var _a = GeographicLib.Geodesic.WGS84._a;
  var eps_ = 0.01 * Math.sqrt( Number.EPSILON );
  var x = point[0];
  var y = point[1];

  var azi0 = Math.atan2( x, y ) / GeographicLib.Math.degree;
  var rho = Math.hypot( x, y );
  var s = _a * Math.atan( rho / _a );
  var little = rho <= _a;
  if ( !little ) {
    rho = 1 / rho;
  }
  var line = new GeographicLib.GeodesicLine.GeodesicLine(
    GeographicLib.Geodesic.WGS84,
    center[1],
    center[0],
    azi0,
    GeographicLib.Geodesic.LATITUDE | GeographicLib.Geodesic.LONGITUDE |
    GeographicLib.Geodesic.AZIMUTH | GeographicLib.Geodesic.DISTANCE_IN |
    GeographicLib.Geodesic.REDUCEDLENGTH | GeographicLib.Geodesic.GEODESICSCALE
  );
  var count = 10;
  var trip = 0;
  var pos;
  while ( count-- ) {
    pos = line.GenPosition(
      false,
      s,
      GeographicLib.Geodesic.LATITUDE | GeographicLib.Geodesic.LONGITUDE |
      GeographicLib.Geodesic.AZIMUTH | GeographicLib.Geodesic.REDUCEDLENGTH |
      GeographicLib.Geodesic.GEODESICSCALE
    );
    if ( trip ) {
      break;
    }
    // If little, solve rho(s) = rho with drho(s)/ds = 1/M^2
    // else solve 1/rho(s) = 1/rho with d(1/rho(s))/ds = -1/m^2
    var ds = little ?
      ( pos.m12 / pos.M12 - rho ) * pos.M12 * pos.M12 :
      ( rho - pos.M12 / pos.m12 ) * pos.m12 * pos.m12;
    s -= ds;
    // Reversed test to allow escape with NaNs
    if ( Math.abs( ds ) < eps_ * _a ) {
      trip++;
    }
  }
  var lat, lon, azi, rk;
  if ( trip ) {
    lat = pos.lat2;
    lon = pos.lon2;
    azi = pos.azi2;
    rk = pos.M12;
  } else {
    lat = lon = azi = rk = NaN;
  }
  return [ lon, lat ];
}
