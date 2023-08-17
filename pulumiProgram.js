"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const pulumiProgram = (jsonObj, DepGraph, pulumi2, dir, tags) => () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        process.env.NODE_PATH = dir;
        require("module").Module._initPaths();
        const connections = jsonObj.connections;
        const properties = jsonObj.properties;
        const completeProperties = jsonObj.completeProperties;
        const canvasState = jsonObj.canvasState;
        const requiredProperties = {};
        const requiredPropertiesDataTypes = {};
        const requiredCanvasState = {};
        const dependencyGraph = new DepGraph({ circular: true });
        const isConnected = {};
        const _ = require('lodash');
        const fs = require('fs');
        const pulumi = require('@pulumi/pulumi');
        const customResourceOptions = {
            customTimeouts: {
                create: "30m",
                update: "30m",
                delete: "30m",
            }
        };
        for (const prop of properties) {
            const props = prop.properties;
            const propKey = {};
            for (const pro of props) {
                if (propKey[pro.value] !== '') {
                    if (pro.dataType.indexOf('array') !== -1 && !Array
                        .isArray(pro.value))
                        propKey[pro.name] = [pro.value];
                    else if (pro.dataType == 'any')
                        propKey[pro.name] = JSON.parse(pro.value);
                    else if (pro.dataType == 'pulumi.asset.Archive')
                        propKey[pro.name] = new pulumi.asset.RemoteArchive([pro.value]);
                    else if (pro.dataType == 'pulumi.asset.Asset')
                        propKey[pro.name] = new pulumi.asset.RemoteAsset([pro.value]);
                    else
                        propKey[pro.name] = pro.value;
                    if (pro.name === 'tags' && tags) {
                        propKey[pro.name] = Object.assign(Object.assign({}, pro.value), tags);
                        console.log(pro);
                    }
                }
            }
            if (!propKey.tags && tags)
                propKey.tags = Object.assign({}, tags);
            requiredProperties[prop.key] = propKey;
        }
        for (const prop of completeProperties) {
            const props = prop.properties;
            const dataTypeKey = {};
            for (const pro of props) {
                dataTypeKey[pro.name] = pro.dataType;
            }
            requiredPropertiesDataTypes[prop.key] = dataTypeKey;
        }
        for (const s of canvasState) {
            if (!s.isGroup && s.canvasState !== "deleteIcon") {
                requiredCanvasState[s.key] = s;
                dependencyGraph.addNode('' + s.key);
            }
        }
        for (const conn of connections) {
            const fromKey = conn.from;
            const toKey = conn.to;
            if (requiredCanvasState[fromKey] && requiredCanvasState[toKey]) {
                let toProperty = null;
                let fromProperty = null;
                let toArray = null;
                let fromArray = null;
                if (conn.toPort)
                    toProperty = conn.toPort.split("-").pop().trim();
                if (conn.fromPort)
                    fromProperty = conn.fromPort.split("-").pop().trim();
                if (conn.fromJson) {
                    fromProperty = null;
                    fromArray = conn.fromJson;
                }
                if (conn.toJson) {
                    toProperty = null;
                    toArray = conn.toJson;
                }
                let toObj = {};
                let fromObj = {};
                if (toProperty) {
                    toObj = {
                        toProperty,
                        type: 'port'
                    };
                }
                else if (toArray) {
                    toObj = {
                        toProperty: toArray,
                        type: 'array'
                    };
                }
                if (fromProperty) {
                    fromObj = {
                        fromProperty,
                        type: 'port'
                    };
                }
                else if (fromArray) {
                    fromObj = {
                        fromProperty: fromArray,
                        type: 'array'
                    };
                }
                if (isConnected[fromKey]) {
                    const data = isConnected[fromKey];
                    let flag = false;
                    for (const d of data) {
                        if (d.key === toKey) {
                            d.conns.push({ toObj, fromObj });
                            flag = true;
                            break;
                        }
                    }
                    if (!flag) {
                        isConnected[fromKey].push({
                            key: toKey,
                            conns: [{ toObj, fromObj }]
                        });
                    }
                }
                else {
                    isConnected[fromKey] = [{
                            key: toKey,
                            conns: [{ toObj, fromObj }]
                        }];
                }
                dependencyGraph.addDependency('' + toKey, '' + fromKey);
            }
        }
        const mapping = {};
        const order = dependencyGraph.overallOrder();
        console.log(order);
        console.log(tags);
        const connectionArrayParser = (conArray) => {
            console.log(conArray);
            let conArrayStr = "";
            let finalDatatype = "";
            for (const con of conArray) {
                if (con.apiType == 'object') {
                    conArrayStr += '["' + con.value + '"]';
                }
                else if (con.apiType == 'array') {
                    if (con.apiPosValue && con.apiPosValue !== '') {
                        con.apiPosValue = parseInt(con.apiPosValue, 10) - 1;
                        conArrayStr += '["' + con.value + '"]' + '[' + con.apiPosValue + ']';
                    }
                    else {
                        conArrayStr += '["' + con.value + '"]';
                    }
                }
                finalDatatype = con.apiType;
            }
            console.log(conArrayStr);
            console.log(finalDatatype);
            return { conArrayStr, finalDatatype };
        };
        const makeConnectionsFromConObjects = (o, dep, toObj, fromObj) => {
            console.log(toObj);
            console.log(fromObj);
            for (let i = 0; i < toObj.length; i++) {
                const toProps = connectionArrayParser(toObj[i]);
                const fromProps = connectionArrayParser(fromObj[i]);
                const toConArray = toProps.conArrayStr;
                const fromConArray = fromProps.conArrayStr;
                const toFinalDatatype = toProps.finalDatatype;
                console.log(toFinalDatatype);
                const fromFinalDatatype = fromProps.finalDatatype;
                if (toFinalDatatype != 'array') {
                    try {
                        eval(`console.log(requiredProperties[${o}]${toConArray})`);
                        if (!eval(`requiredProperties[${o}]${toConArray}`)) {
                            _.set(requiredProperties[o], toConArray, {});
                        }
                    }
                    catch (e) {
                        _.set(requiredProperties[o], toConArray, {});
                    }
                    console.log(`requiredProperties[${o}]${toConArray} = mapping[${dep}]${fromConArray}`);
                    // @ts-ignore
                    eval(`requiredProperties[${o}]${toConArray} = mapping[${dep}]${fromConArray}`);
                }
                else {
                    try {
                        eval(`console.log(requiredProperties[${o}]${toConArray})`);
                        if (!eval(`requiredProperties[${o}]${toConArray}`)) {
                            _.set(requiredProperties[o], toConArray, []);
                        }
                    }
                    catch (e) {
                        _.set(requiredProperties[o], toConArray, []);
                    }
                    console.log(`requiredProperties[${o}]${toConArray}.push(mapping[${dep}]${fromConArray})`);
                    // @ts-ignore
                    eval(`requiredProperties[${o}]${toConArray}.push(mapping[${dep}]${fromConArray})`);
                }
            }
        };
        for (let o of order) {
            o = parseInt(o, 10);
            const component = requiredCanvasState[o];
            const deps = dependencyGraph.dependenciesOf(o);
            for (let dep of deps) {
                dep = parseInt(dep, 10);
                const depMap = isConnected[dep];
                for (const d of depMap) {
                    if (d.key === o) {
                        const conns = d.conns;
                        for (const conn of conns) {
                            if (conn.fromObj.type === 'port') {
                                if (conn.fromObj.fromProperty === 'connection') {
                                    conn.fromObj.fromProperty = 'id';
                                    if (component.componentCategory.cloudPlatform.cloudPlatformName == 'azure-native') {
                                        conn.fromObj.fromProperty = 'name';
                                        if (conn.toObj.toProperty.endsWith('Id') || conn.toObj.toProperty.endsWith('Ids')) {
                                            conn.fromObj.fromProperty = 'id';
                                        }
                                    }
                                }
                            }
                            if (conn.toObj.type === 'port') {
                                if (requiredProperties[o]) {
                                    if (requiredPropertiesDataTypes[o] && requiredPropertiesDataTypes[o][conn.toObj.toProperty].indexOf('array') !== -1) {
                                        if (requiredProperties[o][conn.toObj.toProperty]) {
                                            if (conn.fromObj.fromProperty === 'id' && (requiredCanvasState[dep].name.trim() === 'ListenerDefaultAction' || component.isInterface == true))
                                                requiredProperties[o][conn.toObj.toProperty].push(mapping[dep]);
                                            else
                                                requiredProperties[o][conn.toObj.toProperty].push(mapping[dep][conn.fromObj.fromProperty]);
                                        }
                                        else {
                                            if (conn.fromObj.fromProperty === 'id' && (requiredCanvasState[dep].name.trim() === 'ListenerDefaultAction' || component.isInterface == true))
                                                requiredProperties[o][conn.toObj.toProperty] = [mapping[dep]];
                                            else
                                                requiredProperties[o][conn.toObj.toProperty] = [mapping[dep][conn.fromObj.fromProperty]];
                                        }
                                    }
                                    else {
                                        if (conn.fromObj.fromProperty === 'id' && (requiredCanvasState[dep].name.trim() === 'ListenerDefaultAction' || component.isInterface == true))
                                            requiredProperties[o][conn.toObj.toProperty] = mapping[dep];
                                        else
                                            requiredProperties[o][conn.toObj.toProperty] = mapping[dep][conn.fromObj.fromProperty];
                                    }
                                }
                                else {
                                    if (requiredPropertiesDataTypes[o] && requiredPropertiesDataTypes[o][conn.toObj.toProperty].indexOf('array') !== -1) {
                                        if (conn.fromObj.fromProperty === 'id' && (requiredCanvasState[dep].name.trim() === 'ListenerDefaultAction' || component.isInterface == true))
                                            requiredProperties[o] = {
                                                [conn.toObj.toProperty]: [mapping[dep]]
                                            };
                                        else
                                            requiredProperties[o] = {
                                                [conn.toObj.toProperty]: [mapping[dep][conn.fromObj.fromProperty]]
                                            };
                                    }
                                    else {
                                        if (conn.fromObj.fromProperty === 'id' && (requiredCanvasState[dep].name.trim() === 'ListenerDefaultAction' || component.isInterface == true))
                                            requiredProperties[o] = {
                                                [conn.toObj.toProperty]: mapping[dep]
                                            };
                                        else
                                            requiredProperties[o] = {
                                                [conn.toObj.toProperty]: mapping[dep][conn.fromObj.fromProperty]
                                            };
                                    }
                                }
                            }
                            else {
                                makeConnectionsFromConObjects(o, dep, conn.toObj.toProperty, conn.fromObj.fromProperty);
                            }
                        }
                    }
                }
            }
            let name = `id${o}`;
            if (requiredProperties[o] && requiredProperties[o].name)
                name = requiredProperties[o].name + name;
            const componentName = component.name.trim();
            if (component.isInterface !== true) {
                const componentCategory = component.componentCategory.componentCategoryName.trim();
                const categorySplit = componentCategory.split('.');
                const cloudPlatform = component.componentCategory.cloudPlatform;
                const lib = require(cloudPlatform.cloudPlatformPulumiLibrary.trim());
                if (categorySplit.length == 1) {
                    if (componentCategory == '') {
                        mapping[o] = new lib[componentName](name, requiredProperties[o] ? requiredProperties[o] : {}, customResourceOptions);
                    }
                    else {
                        mapping[o] = new lib[componentCategory][componentName](name, requiredProperties[o] ? requiredProperties[o] : {}, customResourceOptions);
                    }
                }
                else if (categorySplit.length == 2)
                    mapping[o] = new lib[categorySplit[0]][categorySplit[1]][componentName](name, requiredProperties[o] ? requiredProperties[o] : {}, customResourceOptions);
                if (requiredProperties[o].totalCount) {
                    let count = parseInt(requiredProperties[o].totalCount, 10);
                    count = count - 1;
                    for (let i = 0; i < count; i++) {
                        name = name + "-" + (i + 1);
                        if (requiredProperties[o]) {
                            if (requiredProperties[o].tags && requiredProperties[o].tags.Name) {
                                requiredProperties[o].tags.Name = requiredProperties[o].tags.Name + "-" + (i + 1);
                            }
                        }
                        if (categorySplit.length == 1) {
                            if (componentCategory == '') {
                                mapping[o + "-" + (i + 1)] = new lib[componentName](name, requiredProperties[o] ? requiredProperties[o] : {}, customResourceOptions);
                            }
                            else {
                                mapping[o + "-" + (i + 1)] = new lib[componentCategory][componentName](name, requiredProperties[o] ? requiredProperties[o] : {}, customResourceOptions);
                            }
                        }
                        else if (categorySplit.length == 2)
                            mapping[o + "-" + (i + 1)] = new lib[categorySplit[0]][categorySplit[1]][componentName](name, requiredProperties[o] ? requiredProperties[o] : {}, customResourceOptions);
                    }
                }
            }
            else {
                mapping[o] = requiredProperties[o] ? requiredProperties[o] : {};
            }
        }
    }
    catch (err) {
        if (err.toString().indexOf('ENOENT') !== -1) {
            console.log(err);
            process.exit(0);
        }
        else {
            throw err;
        }
    }
});
module.exports = pulumiProgram;
//# sourceMappingURL=pulumiProgram.js.map