declare namespace kakao.maps {
  function load(callback: () => void): void;

  class Map {
    constructor(container: HTMLElement, options: MapOptions);
    setCenter(latlng: LatLng): void;
    getCenter(): LatLng;
    setLevel(level: number): void;
    getLevel(): number;
    getBounds(): LatLngBounds;
    panTo(latlng: LatLng): void;
    addOverlayMapTypeId(mapTypeId: MapTypeId): void;
    removeOverlayMapTypeId(mapTypeId: MapTypeId): void;
  }

  interface MapOptions {
    center: LatLng;
    level: number;
  }

  class LatLng {
    constructor(lat: number, lng: number);
    getLat(): number;
    getLng(): number;
  }

  class LatLngBounds {
    getSouthWest(): LatLng;
    getNorthEast(): LatLng;
  }

  class Size {
    constructor(width: number, height: number);
  }

  class Point {
    constructor(x: number, y: number);
  }

  class Marker {
    constructor(options: MarkerOptions);
    setMap(map: Map | null): void;
    getMap(): Map | null;
    setPosition(latlng: LatLng): void;
    getPosition(): LatLng;
    setImage(image: MarkerImage): void;
    setZIndex(zIndex: number): void;
  }

  interface MarkerOptions {
    map?: Map;
    position: LatLng;
    image?: MarkerImage;
    title?: string;
    zIndex?: number;
  }

  class MarkerImage {
    constructor(src: string, size: Size, options?: MarkerImageOptions);
  }

  interface MarkerImageOptions {
    offset?: Point;
    spriteOrigin?: Point;
    spriteSize?: Size;
  }

  class Circle {
    constructor(options: CircleOptions);
    setMap(map: Map | null): void;
    getMap(): Map | null;
    setRadius(radius: number): void;
    setPosition(latlng: LatLng): void;
  }

  interface CircleOptions {
    map?: Map;
    center: LatLng;
    radius: number;
    strokeWeight?: number;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeStyle?: string;
    fillColor?: string;
    fillOpacity?: number;
    zIndex?: number;
  }

  class InfoWindow {
    constructor(options: InfoWindowOptions);
    open(map: Map, marker: Marker): void;
    close(): void;
    setContent(content: string | HTMLElement): void;
    getContent(): HTMLElement;
  }

  interface InfoWindowOptions {
    content?: string | HTMLElement;
    disableAutoPan?: boolean;
    zIndex?: number;
    removable?: boolean;
    position?: LatLng;
  }

  class CustomOverlay {
    constructor(options: CustomOverlayOptions);
    setMap(map: Map | null): void;
    getMap(): Map | null;
    setPosition(latlng: LatLng): void;
    setContent(content: string | HTMLElement): void;
    getContent(): HTMLElement;
  }

  interface CustomOverlayOptions {
    map?: Map;
    position: LatLng;
    content: string | HTMLElement;
    zIndex?: number;
    yAnchor?: number;
    xAnchor?: number;
  }

  enum MapTypeId {
    NORMAL = 1,
    SKYVIEW = 2,
    HYBRID = 3,
    ROADMAP = 7,
  }

  namespace event {
    function addListener(
      target: Map | Marker | CustomOverlay,
      type: string,
      handler: (e?: MouseEvent) => void
    ): object;
    function removeListener(listener: object): void;
  }

  namespace services {
    enum Status {
      OK = 'OK',
      ZERO_RESULT = 'ZERO_RESULT',
      ERROR = 'ERROR',
    }

    enum SortBy {
      ACCURACY = 'ACCURACY',
      DISTANCE = 'DISTANCE',
    }

    interface PlacesSearchOptions {
      x?: number;
      y?: number;
      radius?: number;
      bounds?: LatLngBounds;
      category_group_code?: string;
      size?: number;
      page?: number;
      sort?: SortBy;
    }

    interface PlacesSearchResult {
      id: string;
      place_name: string;
      category_name: string;
      category_group_code: string;
      category_group_name: string;
      phone: string;
      address_name: string;
      road_address_name: string;
      x: string;
      y: string;
      place_url: string;
      distance: string;
    }

    interface PlacesSearchPagination {
      current: number;
      first: number;
      hasGotoPage: (page: number) => boolean;
      isEnd: boolean;
      isFirst: boolean;
      isLast: boolean;
      last: number;
      nextPage: () => void;
      prevPage: () => void;
      totalCount: number;
      gotoPage: (page: number) => void;
      gotoFirst: () => void;
      gotoLast: () => void;
    }

    type PlacesSearchCallback = (
      result: PlacesSearchResult[],
      status: Status,
      pagination: PlacesSearchPagination
    ) => void;

    class Places {
      constructor(map?: Map);
      keywordSearch(
        keyword: string,
        callback: PlacesSearchCallback,
        options?: PlacesSearchOptions
      ): void;
    }

    interface GeocoderAddressResult {
      address_name: string;
      address_type: string;
      x: string;
      y: string;
      address: {
        address_name: string;
        region_1depth_name: string;
        region_2depth_name: string;
        region_3depth_name: string;
        mountain_yn: string;
        main_address_no: string;
        sub_address_no: string;
      };
      road_address: {
        address_name: string;
        region_1depth_name: string;
        region_2depth_name: string;
        region_3depth_name: string;
        road_name: string;
        underground_yn: string;
        main_building_no: string;
        sub_building_no: string;
        building_name: string;
        zone_no: string;
      } | null;
    }

    type AddressSearchCallback = (
      result: GeocoderAddressResult[],
      status: Status
    ) => void;

    type Coord2RegionCodeCallback = (
      result: RegionCodeResult[],
      status: Status
    ) => void;

    interface RegionCodeResult {
      region_type: 'B' | 'H';
      address_name: string;
      region_1depth_name: string;
      region_2depth_name: string;
      region_3depth_name: string;
      region_4depth_name: string;
      code: string;
      x: number;
      y: number;
    }

    class Geocoder {
      addressSearch(address: string, callback: AddressSearchCallback): void;
      coord2RegionCode(
        lng: number,
        lat: number,
        callback: Coord2RegionCodeCallback
      ): void;
    }
  }
}
