/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 * @flow
 */

import React, { Component } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  View,
  Image,
  Dimensions,
  NativeEventEmitter,
  TouchableHighlight,
  NativeModules,
  ImageBackground,
  PermissionsAndroid,
  ListView,
  ScrollView,
  AppState,
  Button,
  Switch
} from 'react-native';
import { StackNavigator } from 'react-navigation';
import BleManager from 'react-native-ble-manager';
import * as Animatable from 'react-native-animatable';
//var ws = new WebSocket('ws://demos.kaazing.com/echo');
var ws = new WebSocket('ws://nmanna.com:8080');
//var ws = new WebSocket('ws://echo.websocket.org');

const window = Dimensions.get('window');
const ds = new ListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2});
const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

class HomeScreen extends React.Component {
  constructor(){
    super()

    this.state = {
      scanning:false,
      peripherals: new Map(),
      switchval: false,
      forslider: false,
      websocket: false,
      appState: ''
    }

    this.tag_x = 20;
    this.tag_y = 20;

    //this.randomid = Math.random().toString(36).substring(7);
    this.randomid = 'rq6p2s';

    this.handleDiscoverPeripheral = this.handleDiscoverPeripheral.bind(this);
    this.handleStopScan = this.handleStopScan.bind(this);
    this.handleUpdateValueForCharacteristic = this.handleUpdateValueForCharacteristic.bind(this);
    this.handleDisconnectedPeripheral = this.handleDisconnectedPeripheral.bind(this);
    this.handleAppStateChange = this.handleAppStateChange.bind(this);
    this.toHex = this.toHex.bind(this);
  }

  static navigationOptions = {
    title: 'TULIP',
    headerStyle: {
      backgroundColor: '#aabbed',
    },
    headerTintColor: '#fff',
    headerTitleStyle: {
      fontWeight: 'bold',
    },
  };
  //start of stolen bluetooth functions
  componentDidMount() {
    AppState.addEventListener('change', this.handleAppStateChange);

    BleManager.start({showAlert: false});

    this.handlerDiscover = bleManagerEmitter.addListener('BleManagerDiscoverPeripheral', this.handleDiscoverPeripheral );
    this.handlerStop = bleManagerEmitter.addListener('BleManagerStopScan', this.handleStopScan );
    this.handlerDisconnect = bleManagerEmitter.addListener('BleManagerDisconnectPeripheral', this.handleDisconnectedPeripheral );
    this.handlerUpdate = bleManagerEmitter.addListener('BleManagerDidUpdateValueForCharacteristic', this.handleUpdateValueForCharacteristic );



    if (Platform.OS === 'android' && Platform.Version >= 23) {
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION).then((result) => {
            if (result) {
              console.log("Permission is OK");
            } else {
              PermissionsAndroid.requestPermission(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION).then((result) => {
                if (result) {
                  console.log("User accept");
                } else {
                  console.log("User refuse");
                }
              });
            }
      });
    }
    ws.onopen = () => {
      console.log("Websocket open");
      this.setState({websocket: true})
       //ws.send('something'); // send a message
    };
  }

  handleAppStateChange(nextAppState) {
    if (this.state.appState.match(/inactive|background/) && nextAppState === 'active') {
      console.log('App has come to the foreground!')
      BleManager.getConnectedPeripherals([]).then((peripheralsArray) => {
        console.log('Connected peripherals: ' + peripheralsArray.length);
      });
    }
    this.setState({appState: nextAppState});
  }

  componentWillUnmount() {
    this.handlerDiscover.remove();
    this.handlerStop.remove();
    this.handlerDisconnect.remove();
    this.handlerUpdate.remove();
  }

  handleDisconnectedPeripheral(data) {
    let peripherals = this.state.peripherals;
    let peripheral = peripherals.get(data.peripheral);
    if (peripheral) {
      peripheral.connected = false;
      peripherals.set(peripheral.id, peripheral);
      this.setState({peripherals});
    }
    console.log('Disconnected from ' + data.peripheral);
  }

   toHex(byteArray) {
    return Array.from(byteArray, function(byte) {
      return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join('')
   }

  handleUpdateValueForCharacteristic(data) {
    console.log('Reved data from ' + data.peripheral + ' characteristic ' + data.characteristic, data.value);
    message = this.toHex(data.value);
    //console.log("message:" + message);
    message = JSON.stringify({"type":"tagUpdate", "message":message, "id":this.randomid});
    ws.onerror = (e) => {
      console.log('Error with websocket');
      alert('Disconnected from the internet, please try again after reconnecting.');
      this.setState({websocket: false});
    };
    ws.onclose = () => {
      console.log('Websocket closed');
      alert('Disconnected from the internet, Reconnecting.');
      this.setState({websocket: false});
      setTimeout(() => {
        var ws = new WebSocket('ws://echo.websocket.org');
      }, 5000);
    };
    if (this.state.websocket == true)   {
      ws.send(message); // send a message
      console.log(message);
      console.log("sent");
    };
  }

  handleStopScan() {
    console.log('Scan is stopped');
    this.setState({ scanning: false });
  }

  startScan() {
    if (!this.state.scanning) {
      this.setState({peripherals: new Map()});
      BleManager.scan([], 3, true).then((results) => {
        console.log('Scanning...');
        this.setState({scanning:true,
                       forslider: true
        });
      });
    }
  }

  retrieveConnected(){
    BleManager.getConnectedPeripherals([]).then((results) => {
      console.log(results);
      var peripherals = this.state.peripherals;
      for (var i = 0; i < results.length; i++) {
        var peripheral = results[i];
        peripheral.connected = true;
        peripherals.set(peripheral.id, peripheral);
        this.setState({ peripherals });
      }
    });
  }

  handleDiscoverPeripheral(peripheral){
    var peripherals = this.state.peripherals;
    if (!peripherals.has(peripheral.id)){
      console.log('Got ble peripheral', peripheral);
      peripherals.set(peripheral.id, peripheral);
      this.setState({ peripherals })
    }
  }

  test(peripheral) {
    if (peripheral){
      if (peripheral.connected){
        BleManager.disconnect(peripheral.id);
      }else{
        BleManager.connect(peripheral.id).then(() => {
          let peripherals = this.state.peripherals;
          let p = peripherals.get(peripheral.id);
          if (p) {
            p.connected = true;
            peripherals.set(peripheral.id, p);
            this.setState({peripherals});
          }
          console.log('Connected to ' + peripheral.id);


          setTimeout(() => {

            /* Test read current RSSI value
            BleManager.retrieveServices(peripheral.id).then((peripheralData) => {
              console.log('Retrieved peripheral services', peripheralData);
              BleManager.readRSSI(peripheral.id).then((rssi) => {
                console.log('Retrieved actual RSSI value', rssi);
              });
            });*/

            // Test using bleno's pizza example
            // https://github.com/sandeepmistry/bleno/tree/master/examples/pizza
            BleManager.retrieveServices(peripheral.id).then((peripheralInfo) => {
              console.log(peripheralInfo);
              var service = 'B6B47992-21CD-11E8-B467-0ED5F89F718B';
              var bakeCharacteristic = 'B6B47FDC-21CD-11E8-B467-0ED5F89F718B';
              var crustCharacteristic = '13333333-3333-3333-3333-333333330001';

              setTimeout(() => {
                BleManager.startNotification(peripheral.id, service, bakeCharacteristic).then(() => {
                  console.log('Started notification on ' + peripheral.id);
                   this.props.navigation.navigate('Details');
                  setTimeout(() => {
                    BleManager.write(peripheral.id, service, crustCharacteristic, [0]).then(() => {
                      console.log('Writed NORMAL crust');
                      BleManager.write(peripheral.id, service, bakeCharacteristic, [1,95]).then(() => {
                        console.log('Writed 351 temperature, the pizza should be BAKED');
                        /*
                        var PizzaBakeResult = {
                          HALF_BAKED: 0,
                          BAKED:      1,
                          CRISPY:     2,
                          BURNT:      3,
                          ON_FIRE:    4
                        };*/
                      });
                    });

                  }, 500);
                }).catch((error) => {
                  console.log('Notification error', error);
                });
              }, 200);
            });

          }, 900);
        }).catch((error) => {
          console.log('Connection error', error);
        });
      }
    }
  }
  //end of stolen bluetooth functions
  render() {
    const list = Array.from(this.state.peripherals.values());
    const dataSource = ds.cloneWithRows(list);
    const valuex = this.tag_x;
    const valuey = this.tag_y;
    const forslider = this.state.forslider;
    var {height, width} = Dimensions.get('window');
    //const switchval = false;
    return (
     <View>
         <Text>WS Connected? ({this.state.websocket ? 'Yes' : 'No'})</Text>
         <View style={{flexDirection: 'row'}}>
                <View style={{width: width*0.6, height: height/4, alignItems: 'center'}}>
                    <Text style={{position: 'relative', top: height/8.5, fontSize: 30}}>Scan Bluetooth</Text>
                </View>
                <View style={{width: width*0.4, height: height/4, alignItems: 'center'}}>
                    <Switch
                      style={{position: 'relative', top: height/8, transform: [{ scaleX: 2 }, { scaleY: 2 }]}}
                      onValueChange={() => this.startScan()
                      }
                      value={forslider}
                    />
                </View>
         </View>
        <View style={{flexDirection: 'column', justifyContent: 'center', alignItems: 'center'}}>
            <View style={{width: 200, height: 100, alignItems: 'center'}}>
                     <TouchableHighlight style={{padding: 10, backgroundColor: '#aabbed', width:200}}onPress={() => this.startScan() }>
                         <View style={[styles.row]}>
                             <Text style={{fontSize: 18, textAlign: 'center', color: 'white', padding: 10}}>Refresh</Text>
                         </View>
                     </TouchableHighlight>
            </View>
            <View style={{width: width, height: height/3}} >
                 <ScrollView style={styles.scroll}>
                       {(list.length == 0) &&
                            <View style={{flex:1, margin: 20}}>
                                <Text style={{textAlign: 'center'}}>No tags</Text>
                            </View>
                       }
                       <ListView
                            style ={{backgroundColor: '#eff6fd'}}
                            enableEmptySections={true}
                            dataSource={dataSource}
                            renderRow={(item) => {
                            const color = item.connected ? '#aabbed' : '#f0f0f0';
                       return (
                            <TouchableHighlight onPress={() => this.test(item) }>
                                <View style={[styles.row, {backgroundColor: color}]}>
                                    <Text style={{fontSize: 18, textAlign: 'center', color: '#333333', padding: 10}}>{item.name}</Text>
                                    <Text style={{fontSize: 14, textAlign: 'center', color: '#333333', padding: 10}}>{item.id}</Text>
                                </View>
                            </TouchableHighlight>
                       );
                         }}
                       />
                 </ScrollView>
                 <Button
                     title="Go to Details"
                     onPress={() => this.props.navigation.navigate('Details')}
                  />
            </View>
         </View>
     </View>
     //<Text>WS Connected? ({this.state.websocket ? 'Yes' : 'No'})</Text>
     /*<View style={{styles.container}}>
             <Button
                title="Go to Details"
                onPress={() => this.props.navigation.navigate('Details')}
              />
            *//*<TouchableHighlight style={{marginTop: 40,margin: 20, padding:20, backgroundColor:'#ccc'}} onPress={() => this.startScan() }>
              <Text>Scan Bluetooth ({this.state.scanning ? 'on' : 'off'})</Text>
            </TouchableHighlight>
            <Switch
              onValueChange={() => this.startScan()
              }
              value={switchval}
            />
            <TouchableHighlight style={{marginTop: 0,margin: 20, padding:20, backgroundColor:'#ccc'}} onPress={() => this.retrieveConnected() }>
              <Text>Retrieve connected peripherals</Text>
            </TouchableHighlight>
            <Text style={{position: 'relative', textAlign: 'left', fontSize: 18, backgroundColor: 'yellow'}}>X: {valuex}</Text>
            <Text style={{position: 'relative', textAlign: 'left', fontSize: 18, backgroundColor: 'yellow'}}>Y: {valuey}</Text>*//*
            <ScrollView style={styles.scroll}>
              {(list.length == 0) &&
                <View style={{flex:1, margin: 20}}>
                  <Text style={{textAlign: 'center'}}>No peripherals</Text>
                </View>
              }
              <ListView
                enableEmptySections={true}
                dataSource={dataSource}
                renderRow={(item) => {
                  const color = item.connected ? 'green' : '#fff';
                  return (
                   <TouchableHighlight onPress={() => this.test(item) }>
                     <View style={[styles.row, {backgroundColor: color}]}>
                       <Text style={{fontSize: 12, textAlign: 'center', color: '#333333', padding: 10}}>{item.name}</Text>
                       <Text style={{fontSize: 8, textAlign: 'center', color: '#333333', padding: 10}}>{item.id}</Text>
                     </View>
                   </TouchableHighlight>
                 );
                }}
              />
            </ScrollView>
            <Text>Home Screen</Text>
                <Button
                  title="Go to Details"
                  onPress={() => this.props.navigation.navigate('Details')}
                />
      </View>*/
    );
  }
}
//MAP SCREEN STUFF -------------------------------------------------------------------------------------------------------------------------------------------------------------------------

const Dcmap = ({ children }) => (
  <ImageBackground source={require('./images/dc_anchor.png')} style={{ height: 500}}>
    {children}
  </ImageBackground>
);

const FlippingImage = ({ initx, inity, finalx, finaly, source, style = {} }) => (
  <Animatable.Image
    animation={{
          from: { translateX: initx, translateY: inity },
          to: { translateX: finalx, translateY: finaly },
        }}
    source={source}
    style={{
      ...style,
      backfaceVisibility: 'hidden',
    }}
  />
);

class DetailsScreen extends React.Component {
  constructor(props){
       super(props)

       this.state = {
         count: 0, //y
         count2: 0, //x
         initpos: 0, //y
         initpos2: 0, //x
         anchor1: false,
         anchor2: false,
         anchor3: false,
         anchor4: false
       }

      //this.tag_x = 20;
       //this.tag_y = 20;
       this.tag_states = {
          'id': {'ranges': { '0001': null,
                               '0003': null,
                               '0002': null,
                               '0004': null
           }, 'x':NaN,  'y':NaN}, // one anchor has to be at (0,0)
       }
       this.randomid = Math.random().toString(36).substring(7);
       this.data = null;

       this.anchor_states = {
           '0001': {'x': 0, 'y':0, 'h':0, 'active':false}, // one anchor has to be at (0,0)
           '0002': {'x': 0, 'y':2, 'h':0, 'active':false},
           '0003': {'x': 2, 'y':0, 'h':0, 'active':false},
           '0004': {'x': 2, 'y':2, 'h':0, 'active':false}
       }
   }
   static navigationOptions = {
       title: 'Indoor Map',
       headerStyle: {
         backgroundColor: '#aabbed',
       },
       headerTintColor: '#fff',
       headerTitleStyle: {
         fontWeight: 'bold',
       },
   };
   componentDidMount() {
    ws.onmessage = (e) => {
      obj = JSON.parse(e.data);
      this.anchor_states = obj.anchor_states;
      if ('rq6p2s' in obj.tag_states)
        {
          this.tag_states['id'] = obj.tag_states['rq6p2s'];
         // if (this.tag_states['id']['y'] >= 0 && this.tag_states['id']['x'] >= 0)
           // {
              this.setState({
                    initpos: this.state.count,
                    initpos2: this.state.count2,
                    count: (6.1855*this.tag_states['id']['y'])+120, //y
                    count2: (12.5*this.tag_states['id']['x'])+130 //x
               });
           // }
          console.log(obj);
          console.log(obj.anchor_states['0001']['active']);
          console.log(obj.anchor_states['0002']['active']);
          console.log(obj.anchor_states['0003']['active']);
          console.log(obj.anchor_states['0004']['active']);
        }
      if (obj.anchor_states['0001']['active'] == true)
        {
             this.setState({
                    anchor1: true,
             });
        } else {
             this.setState({
                    anchor1: false,
             });
         }
      if (obj.anchor_states['0002']['active'] == true)
         {
           this.setState({
                    anchor2: true,
            });
         } else {
              this.setState({
                    anchor2: false,
             });
         }
      if (obj.anchor_states['0003']['active']== true)
        {
          this.setState({
                    anchor3: true,
           });
        } else {
             this.setState({
                    anchor3: false,
            });
         }
      if (obj.anchor_states['0004']['active']== true)
        {
          this.setState({
                    anchor4: true,
           });
        } else {
             this.setState({
                    anchor4: false,
            });
         }
    };
/*    obj = JSON.parse(e.data);
          this.anchor_states = obj.anchor_states;
          if ('rq6p2s' in obj.tag_states)
            {
              this.tag_states['id'] = obj.tag_states['rq6p2s'];
              this.setState({
                        initpos: this.state.count,
                        initpos2: this.state.count2,
                        count: 25*this.tag_states['id']['x'],
                        count2: 25*this.tag_states['id']['y']
               });
              console.log(obj);
            }*/
   }
//end of bluetooth testing
  render() {
  const valx = Math.round(this.tag_states['id']['x'] * 100) / 100;
  const valy = Math.round(this.tag_states['id']['y'] * 100) / 100;
  //const avgx = (this.state.count*2/3) + ((this.state.initpos)/3);
  const avgx = this.state.count;
  const avgy = this.state.count2;
  //const avgy = (this.state.count2*2/3) + ((this.state.initpos2)/3);
  var {height, width} = Dimensions.get('window');
    return (
      <Dcmap>
      <View>
           <FlippingImage
              initx = {this.state.initpos}
              inity = {this.state.initpos2}
              finalx = {avgx}
              finaly = {avgy}
              style={{width: 35, height: 35}}
              source={require('./images/map_marker.png')}
           />
      </View>
        <View style={{position: 'absolute', top: height - 140, flex: 1, flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#aabbed'}}>
            <View style={{width: width/3, height:100, alignItems: 'center'}}>
                <Text style={{position: 'relative',textAlign: 'left', top:12, fontSize: 24, color: 'white', backgroundColor: '#aabbed'}}>X: {valx}</Text>
            </View>
            <View style={{width: width/3, height:100, alignItems: 'center'}}>
                <Text style={{position: 'relative', textAlign: 'left', top:12, fontSize: 24, color: 'white', backgroundColor: '#aabbed'}}>Y: {valy}</Text>
            </View>
            <View style={{width: width/3, height:100, alignItems: 'center'}}>
                <Text style={{fontSize: 10, color: 'white'}}>Anchor1 ({this.state.anchor1 ? 'Active' : 'Inactive'})</Text>
                <Text style={{fontSize: 10, color: 'white'}}>Anchor2 ({this.state.anchor2 ? 'Active' : 'Inactive'})</Text>
                <Text style={{fontSize: 10, color: 'white'}}>Anchor3 ({this.state.anchor3 ? 'Active' : 'Inactive'})</Text>
                <Text style={{fontSize: 10, color: 'white'}}>Anchor4 ({this.state.anchor4 ? 'Active' : 'Inactive'})</Text>
            </View>
        </View>
      </Dcmap>
    );
  }
}

  /*<View style={{width: 220, left:220, bottom:70}}>
        <Text>Anchor1 ({this.state.anchor1 ? 'Active' : 'Inactive'})</Text>
        <Text>Anchor2 ({this.state.anchor2 ? 'Active' : 'Inactive'})</Text>
        <Text>Anchor3 ({this.state.anchor3 ? 'Active' : 'Inactive'})</Text>
        <Text>Anchor4 ({this.state.anchor4 ? 'Active' : 'Inactive'})</Text>
             <Text style={{position: 'relative', top:100, textAlign: 'left', fontSize: 18, backgroundColor: 'yellow'}}>X: {valx}</Text>
             <Text style={{position: 'relative', top:100, textAlign: 'left', fontSize: 18, backgroundColor: 'yellow'}}>Y: {valy}</Text>
                   <FlippingImage
                      finalx = {12.5*this.state.count2 + 130} // regular axis
                      finaly = {6.186*this.state.count + 120}
                      finalx = {12.5*this.state.count + 130} //flipped axis
                      finaly = {6.186*this.state.count2 + 120}
                      initx = {this.state.initpos2}
                      inity = {this.state.initpos}
                      finalx = {this.state.count2}
                      finaly = {this.state.count}
                      style={{width: 35, height: 35}}
                      source={require('./images/map_marker.png')}
                   />
                         <FlippingImage
                                  initx = {40}
                                  inity = {200}
                                  finalx = {40}
                                  finaly = {200}
                                  style={{width: 10, height: 10}}
                                  source={require('./images/green.png')}
                               />
                         <FlippingImage
                                  initx = {110}
                                  inity = {65}
                                  finalx = {110}
                                  finaly = {65}
                                  style={{width: 10, height: 10}}
                                  source={require('./images/green.png')}
                               />
                         <FlippingImage
                                  initx = {125}
                                  inity = {210}
                                  finalx = {125}
                                  finaly = {210}
                                  style={{width: 10, height: 10}}
                                  source={require('./images/green.png')}
                          />
  </View>*/

const RootStack = StackNavigator(
  {
    Home: {
      screen: HomeScreen,
    },
    Details: {
      screen: DetailsScreen,
    },
  },
  {
    initialRouteName: 'Home',
  }
);

export default class App extends React.Component {
  render() {
    return <RootStack />;
  }
}











//var math = require('mathjs');

/*const instructions = Platform.select({
  ios: 'Press Cmd+R to reload,\n' +
    'Cmd+D or shake for dev menu',
  android: 'Double tap R on your keyboard to reload,\n' +
    'Shake or press menu button for dev menu',
});*/

type Props = {};
/*export default class App extends Component<Props> {
  render() {
    return (
      <View style={styles.container}>
        <Text style={styles.welcome}>
          Welcome to React Native!
        </Text>
        <Text style={styles.instructions}>
          To get started, edit App.js
        </Text>
        <Text style={styles.instructions}>
          {instructions}
        </Text>
      </View>
    );
  }
}*/

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#d8e9fa',
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
  instructions: {
    textAlign: 'center',
    color: '#333333',
    marginBottom: 5,
  },
});
