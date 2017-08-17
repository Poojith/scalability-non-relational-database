var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var http = require('http');
var mysql = require('mysql');
var validator = require('validator');
var session = require('client-sessions');

var index = require('./routes/index');
var users = require('./routes/users');
var read = require("read");
var async = require("async");
var app = express();

var mongoose = require('mongoose');

mongoose.connect('mongodb://poojith:edisspassword@34.207.139.91:27017/ediss_db?authSource=admin', {useMongoClient: true});
mongoose.Promise = global.Promise;
ObjectId = mongoose.Schema.Types.ObjectId;

var db = mongoose.connection;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


app.listen(4000, function () {
    console.log("Express server listening on port 4000");
});

app.use(session({
    cookieName: 'session',
    secret: 'eCommerce_session_secret',
    duration: 15 * 60 * 1000,
    activeDuration: 15 * 60 * 1000
}));

process.env.UV_THREADPOOL_SIZE = 64;

app.use('/', index);
app.use('/users', users);


db.on('error', function (err) {
    console.log('connection error', err);
});
db.once('open', function () {
    console.log('Mongoose: Connected');
});

var Schema = mongoose.Schema;
var userSchema = new Schema({
    fname: {
        type: String,
        required: true
    },
    lname: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    city: {
        type: String,
        required: true
    },
    state: {
        type: String,
        required: true
    },
    zip: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    username: {
        type: String,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    isAdmin: Number
});

var productSchema = new Schema({
    asin: {
        type: String,
        unique: true,
        required: true
    },
    productName: {
        type: String,
        required: true
    },
    productDescription: {
        type: String,
        required: true
    },
    groupCategory: {
        type: String,
        required: true
    }
});

var purchaseSchema = new Schema({
    customerId: {
        type: String,
        required: true
    },
    products: {
        type: [],
        required: true
    }
});


var transactionSchema = new Schema({
    customerId: {
        type: String,
        required: true
    },
    productId: {
        type: String,
        required: true
    },
    productName: {
        type: String,
        required: true
    }
});


var User = mongoose.model('User', userSchema);
var Product = mongoose.model('Product', productSchema);
var Purchase = mongoose.model('Purchase', purchaseSchema);
var Transaction = mongoose.model('Transaction', transactionSchema);

var adminUser = new User({
    fname: 'Jenny',
    lname: 'Admin',
    address: '5000 Forbes Ave',
    city: 'Pittsburgh',
    state: 'PA',
    zip: 15213,
    email: 'jenny@ecom.com',
    username: 'jadmin',
    password: 'admin',
    isAdmin: 1
});

adminUser.save(function (err, data) {
    if (err) console.log(err);
    else console.log('Created admin user');
});

app.post('/registerUser', function (req, res) {
    var request = req.body;
    var firstName = request.fname;
    var lastName = request.lname;
    var address = request.address;
    var city = request.city;
    var state = request.state;
    var zip = request.zip;
    var email = request.email;
    var username = request.username;
    var password = request.password;
    var response;

    if (typeof request.fname === 'undefined' ||
        typeof request.lname === 'undefined' ||
        typeof request.address === 'undefined' ||
        typeof request.city === 'undefined' ||
        typeof request.state === 'undefined' ||
        typeof request.zip === 'undefined' ||
        typeof request.email === 'undefined' ||
        typeof request.username === 'undefined' ||
        typeof request.password === 'undefined') {
        response = {
            "message": "The input you provided is not valid"
        };
        res.send(response);
        return;
    }

    var isFieldEmpty = validator.isEmpty(firstName) || validator.isEmpty(lastName) ||
        validator.isEmpty(address) || validator.isEmpty(city) || validator.isEmpty(state) ||
        validator.isEmpty(zip) || validator.isEmpty(email) ||
        validator.isEmpty(username) || validator.isEmpty(password);

    if (isFieldEmpty) {
        response = {
            "message": "The input you provided is not valid"
        };
        res.send(response);
        return;
    }

    var newUser = new User({
        fname: firstName,
        lname: lastName,
        address: address,
        city: city,
        state: state,
        zip: zip,
        email: email,
        username: username,
        password: password,
        isAdmin: 0
    });

    newUser.save(function (err, data) {
        if (err) {
            response = {
                "message": "The input you provided is not valid"
            };
            console.log("Attempt to create duplicate record for " + username);
            res.send(response);
            return;
        }

        response = {
            "message": firstName + " was registered successfully"
        };
        res.send(response);
    });
});

app.post('/login', function (req, res) {
    var request = req.body;
    var username = request.username;
    var password = request.password;
    var response;

    function getUserInfo() {
        var query = User.find({
            username: username,
            password: password
        });
        return query;
    }

    var query = getUserInfo();
    query.exec(function (err, result) {
        if (result.length === 0) {
            response = {
                "message": "There seems to be an issue with the username/password combination that you entered"
            };
            req.session.reset();
            req.session.user = null;
            res.send(response);
            return;
        } else {
            req.session.user = result[0];
            response = {
                "message": "Welcome " + result[0].fname
            };
            res.send(response);
        }
    });
});


app.post('/logout', function (req, res) {
    var response;
    if (req.session && req.session.user) {
        response = {
            "message": "You have been successfully logged out"
        };
        req.session.reset();
        res.send(response);
        return;
    }
    else {
        response = {
            "message": "You are not currently logged in"
        };
        res.send(response);
        return;
    }
});

app.post('/updateInfo', function (req, res) {
    var request = req.body;
    var firstName = request.fname;
    var lastName = request.lname;
    var address = request.address;
    var city = request.city;
    var state = request.state;
    var zip = request.zip;
    var email = request.email;
    var username = request.username;
    var password = request.password;
    var response;
    var isFieldEmpty;

    if (req.session && req.session.user) {
        var user = req.session.user;
        if (!checkLogin(user.username, user.password)) {
            response = {
                "message": "You are not currently logged in"
            };
            req.session.reset();
            res.send(response);
            return;
        }

        var updatedUser = {};

        if (typeof request.fname !== 'undefined') {
            isFieldEmpty = validator.isEmpty(request.fname);
            if (isFieldEmpty) {
                sendMissingFieldMessage(req, res);
                return;
            }
            updatedUser["fname"] = firstName;
        }

        if (typeof request.lname !== 'undefined') {
            isFieldEmpty = validator.isEmpty(request.lname);
            if (isFieldEmpty) {
                sendMissingFieldMessage(req, res);
                return;
            }
            updatedUser["lname"] = lastName;
        }

        if (typeof request.address !== 'undefined') {
            isFieldEmpty = validator.isEmpty(request.address);
            if (isFieldEmpty) {
                sendMissingFieldMessage(req, res);
                return;
            }
            updatedUser["address"] = address;
        }

        if (typeof request.city !== 'undefined') {
            isFieldEmpty = validator.isEmpty(request.city);
            if (isFieldEmpty) {
                sendMissingFieldMessage(req, res);
                return;
            }
            updatedUser["city"] = city;
        }

        if (typeof request.state !== 'undefined') {
            isFieldEmpty = validator.isEmpty(request.state);
            if (isFieldEmpty) {
                sendMissingFieldMessage(req, res);
                return;
            }
            updatedUser["state"] = state;
        }

        if (typeof request.zip !== 'undefined') {
            isFieldEmpty = validator.isEmpty(request.zip);
            if (isFieldEmpty) {
                sendMissingFieldMessage(req, res);
                return;
            }
            updatedUser["zip"] = zip;
        }

        if (typeof request.email !== 'undefined') {
            isFieldEmpty = validator.isEmpty(request.email);
            if (isFieldEmpty) {
                sendMissingFieldMessage(req, res);
                return;
            }
            updatedUser["email"] = email;
        }

        if (typeof request.username !== 'undefined') {
            isFieldEmpty = validator.isEmpty(request.username);
            if (isFieldEmpty) {
                sendMissingFieldMessage(req, res);
                return;
            }
            updatedUser["username"] = username;
        }

        if (typeof request.password !== 'undefined') {
            isFieldEmpty = validator.isEmpty(request.password);
            if (isFieldEmpty) {
                sendMissingFieldMessage(req, res);
                return;
            }
            updatedUser["password"] = password;
        }

        var oldUsername = {'username': user.username};

        User.update(oldUsername, {$set: updatedUser}, {upsert: false}, function (err, result) {
            if (err || result.affectedRows === 0) {
                response = {
                    "message": "The input you provided is not valid"
                };
                console.log("Error in updating user with username : " + user.username);
                if (err) {
                    console.log(err.message);
                }
                res.send(response);
                return;
            }

            if (typeof request.username !== 'undefined' && result.affectedRows !== 0) {

                var query = User.find({
                    username: username,
                    password: password
                });

                query.exec(function (err, result) {
                    if (err) throw err;
                    if (result.length === 0) {
                        req.session.user.username = user.username;
                    }
                    else {
                        req.session.user = result[0];
                        response = {
                            "message": req.session.user.fname + " your information was successfully updated"
                        };
                        res.send(response);
                    }
                });
            } else {
                response = {
                    "message": user.fname + " your information was successfully updated"
                };
                res.send(response);
            }
        });
    }

    else {
        response = {
            "message": "You are not currently logged in"
        };
        req.session.reset();
        res.send(response);
    }
});

app.post('/addProducts', function (req, res) {
    var request = req.body;
    var asin = request.asin;
    var productName = request.productName;
    var productDescription = request.productDescription;
    var groupVal = request.group;
    var response;

    if (req.session && req.session.user) {
        var user = req.session.user;
        if (!checkLogin(user.username, user.password)) {
            response = {
                "message": "You are not currently logged in"
            };

            req.session.reset();
            res.send(response);
            return;
        }

        if (user.isAdmin === 0) {
            response = {
                "message": "You must be an admin to perform this action"
            };

            res.send(response);
            return;
        }

        if (typeof request.asin === 'undefined' ||
            typeof request.productName === 'undefined' ||
            typeof request.productDescription === 'undefined' ||
            typeof request.group === 'undefined') {
            response = {
                "message": "The input you provided is not valid"
            };
            res.send(response);
            return;
        }

        var isFieldEmpty = validator.isEmpty(asin) || validator.isEmpty(productName) ||
            validator.isEmpty(productDescription) || validator.isEmpty(groupVal);

        if (isFieldEmpty) {
            response = {
                "message": "The input you provided is not valid"
            };
            res.send(response);
            return;
        }

        var newProduct = new Product({
            asin: asin,
            productName: productName,
            productDescription: productDescription,
            groupCategory: groupVal
        });

        newProduct.save(function (err, result) {
            if (err) {
                response = {
                    "message": "The input you provided is not valid"
                };
                console.log(err.message);
                res.send(response);
                return;
            }

            response = {
                "message": productName + " was successfully added to the system"
            };

            res.send(response);
        });
    }

    else {
        response = {
            "message": "You are not currently logged in"
        };
        req.session.reset();
        res.send(response);
    }
});

app.post('/buyProducts', function (req, res) {
    var request = req.body;
    var products = request.products;
    var response;

    if (req.session && req.session.user) {
        var user = req.session.user;
        if (!checkLogin(user.username, user.password)) {
            response = {
                "message": "You are not currently logged in"
            };
            req.session.reset();
            res.send(response);
            return;
        }

        if (typeof request.products === 'undefined') {
            response = {
                "message": "There are no products that match that criteria"
            };
            res.send(response);
            return;
        }

        var isFieldEmpty = validator.isEmpty(JSON.stringify(products));

        if (isFieldEmpty) {
            response = {
                "message": "There are no products that match that criteria"
            };
            res.send(response);
            return;
        }

        var purchasesArray = [];
        var customerID = user.username;

        for (var i = 0; i < products.length; i++) {
            var asin = products[i].asin;

            let validationPromise = new Promise(function (resolve, reject) {
                Product.findOne({asin: asin}, function (err, obj) {
                    if (obj === null) {
                        reject();
                    } else {
                        resolve(obj);
                    }
                });
            });

            validationPromise.then(function (obj) {

            }).catch(function () {

            });
        }


        for (var i = 0; i < products.length; i++) {
            var asin = products[i].asin;
            purchasesArray.push(asin);
            var productName;
            var prodID;


            let productPromise = new Promise(function (resolve, reject) {
                Product.findOne({asin: asin}, function (err, obj) {
                    if (obj === null) {
                        reject('Did not complete product promise');
                    } else {
                        resolve(obj);
                        productName = obj.productName;
                        prodID = obj.asin;
                    }
                });
            });

            productPromise.then(function (obj) {
                var purchaseRecord = new Transaction({
                    customerId: customerID,
                    productId: obj.asin,
                    productName: obj.productName
                });

                purchaseRecord.save(function (err, result) {
                    if (err) {}
                });
            }).catch(function (fromReject) {
                console.log(fromReject);
                response = {
                    "message": "There are no products that match that criteria"
                };
            })
        }


        var purchase = new Purchase({
            customerId: customerID,
            products: purchasesArray
        });

        purchase.save(function (err, result) {
            if (err || result == 0) {
                console.log(err.message);
            } else {
                response = {
                    "message": "The action was successful"
                };
            }

            res.send(response);
            return;
        });
    }

    else {
        response = {
            "message": "You are not currently logged in"
        };
        req.session.reset();
        res.send(response);
    }
});


app.post('/productsPurchased', function (req, res) {
    var request = req.body;
    var username = request.username;
    var response;

    if (req.session && req.session.user) {
        var user = req.session.user;
        if (!checkLogin(user.username, user.password)) {
            response = {
                "message": "You are not currently logged in"
            };

            req.session.reset();
            res.send(response);
            return;
        }

        if (user.isAdmin === 0) {
            response = {
                "message": "You must be an admin to perform this action"
            };

            res.send(response);
            return;
        }

        if (typeof request.username === 'undefined') {
            response = {
                "message": "There are no users that match that criteria"
            };
            res.send(response);
            return;
        }

        var isFieldEmpty = validator.isEmpty(username);

        if (isFieldEmpty) {
            response = {
                "message": "There are no users that match that criteria"
            };
            res.send(response);
            return;
        }

        var customerID = username;
        var query = Transaction.find({customerId: customerID});
        var jsonArray = [];
        var purchasesArray = {};

        let purchasePromise = new Promise(function (resolve, reject) {
            query.exec(function (err, results) {
                if (err) {
                    console.log(err.message);
                    reject('Failed from purchase promise');
                }
                for (var i = 0; i < results.length; i++) {
                    var purchaseRecord = results[i];
                    var productId = purchaseRecord.productId;

                    if (purchasesArray[productId] === undefined) {
                        purchasesArray[productId] = 1;
                    } else {
                        var value = purchasesArray[productId];
                        purchasesArray[productId] = ++value;
                    }
                    if (i == results.length - 1) {
                        resolve(purchasesArray);
                    }
                }
            });
        });

        purchasePromise.then(function (productsList) {
            var length = Object.keys(productsList).length;
            var array = new Array(length);
            for (var i = 0; i < length; i++) {
                var property = Object.keys(productsList)[i];
                array[i] = property;
            }

            var getProductDetails = function () {
                var promises = array.map(function (item) {
                    return Product.findOne({
                        asin: item
                    }).exec()
                        .then(product => {
                            return {
                                productName: product.productName,
                                quantity: productsList[item]
                            };
                        })
                        .then(null, (err) => null);
                });
                return Promise.all(promises);
            };

            getProductDetails().then(results => {
                response = {
                    "message": "The action was successful",
                    "products": results
                };
                res.send(response);
                return;
            }).catch(err => {
                res.sendStatus(500);
            });
        }).catch(function (fromReject) {
            console.log(fromReject);
        })
    }

    else {
        response = {
            "message": "You are not currently logged in"
        };
        req.session.reset();
        res.send(response);
    }
});


app.post('/getRecommendations', function (req, res) {
    var request = req.body;
    var asin = request.asin;
    var response;

    var finalRecommendations = [];

    if (req.session && req.session.user) {
        var user = req.session.user;
        if (!checkLogin(user.username, user.password)) {
            response = {
                "message": "You are not currently logged in"
            };

            req.session.reset();
            res.send(response);
            return;
        }

        if (typeof request.asin === 'undefined') {
            response = {
                "message": "There are no recommendations for that product"
            };
            res.send(response);
            return;
        }

        var isFieldEmpty = validator.isEmpty(asin);

        if (isFieldEmpty) {
            response = {
                "message": "There are no recommendations for that product"
            };
            res.send(response);
            return;
        }

        var query = Purchase.find({"products": asin})
        var recommendations = {};
        var otherProducts = [];

        let recommendationPromise = new Promise(function (resolve, reject) {
            query.exec(function (err, documents) {
                if (err || documents.length == 0) {
                    response = {
                        "message": "There are no recommendations for that product"
                    };
                    reject();
                    res.send(response);
                    return;
                }

                for (var i = 0; i < documents.length; i++) {
                    var document = documents[i];
                    var products = document.products;
                    for (var j = 0; j < products.length; j++) {
                        var individualProduct = products[j];

                        if (individualProduct.localeCompare(asin) != 0) {
                            otherProducts.push(individualProduct);
                        }
                    }
                }

                for (var i = 0; i < otherProducts.length; i++) {
                    var product = otherProducts[i];
                    if (recommendations[product] === undefined) {
                        recommendations[product] = 1;
                    } else {
                        var value = recommendations[product];
                        recommendations[product] = ++value;
                    }
                }

                if (Object.keys(recommendations).length == 0) {
                    response = {
                        "message": "There are no recommendations for that product"
                    };
                    reject();
                    res.send(response);
                    return;
                }

                var sortable = [];
                for (var item in recommendations) {
                    sortable.push([item, recommendations[item]]);
                }

                sortable.sort(function (a, b) {
                    return b[1] - a[1];
                });


                var count = 0;
                for (var key in sortable) {
                    var productId = sortable[key][0];
                    if (count == 5) {
                        break;
                    }
                    finalRecommendations.push({asin: productId});
                    count++;
                }
                resolve(finalRecommendations);
            });
        });

        recommendationPromise.then(function (recommendations) {
            response = {
                "message": "The action was successful",
                "products": recommendations
            };
            res.send(response);
            return;

        }).catch(function () {
            response = {
                "message": "There are no recommendations for that product"
            };
            res.send(response);
            return;
        });
    }

    else {
        response = {
            "message": "You are not currently logged in"
        };
        req.session.reset();
        res.send(response);
    }
});


app.post('/modifyProduct', function (req, res) {
    var request = req.body;
    var asin = request.asin;
    var productName = request.productName;
    var productDescription = request.productDescription;
    var group = request.group;
    var response;

    if (req.session && req.session.user) {
        var user = req.session.user;
        if (!checkLogin(user.username, user.password)) {
            response = {
                "message": "You are not currently logged in"
            };

            req.session.reset();
            res.send(response);
            return;
        }

        if (user.isAdmin === 0) {
            response = {
                "message": "You must be an admin to perform this action"
            };

            res.send(response);
            return;
        }

        if (typeof request.asin === 'undefined' ||
            typeof request.productName === 'undefined' ||
            typeof request.productDescription === 'undefined' ||
            typeof request.group === 'undefined') {
            response = {
                "message": "The input you provided is not valid"
            };
            res.send(response);
            return;
        }

        var isFieldEmpty = validator.isEmpty(asin) || validator.isEmpty(productName) ||
            validator.isEmpty(productDescription) || validator.isEmpty(group);

        if (isFieldEmpty) {
            response = {
                "message": "The input you provided is not valid"
            };
            res.send(response);
            return;
        }

        var productID = asin;

        var query = Product.find({asin: productID});
        query.exec(function (err, result) {
            if (err) console.log(err.message);
            if (result.length === 0) {
                response = {
                    "message": "The input you provided is not valid"
                };
                return res.send(response);
            } else {
                Product.update(productID, {
                    $set: {
                        productName: productName, productDescription: productDescription,
                        groupCategory: group
                    }
                }, {upsert: false}, function (err, result) {
                    console.log(result);
                    if (err || result == 0 || result == null || result.nInserted === 0) {
                        response = {
                            "message": "The input you provided is not valid"
                        };
                        if (err) {
                            console.log(err.message + " for product with asin " + asin + ", name : " + productName);
                        }
                        res.send(response);
                        return;
                    }

                    response = {
                        "message": productName + " was successfully updated"
                    };
                    res.send(response);
                });
            }
        });
    }

    else {
        response = {
            "message": "You are not currently logged in"
        };
        req.session.reset();
        res.send(response);
    }
});

app.post('/viewUsers', function (req, res) {
    var request = req.body;
    var response;

    if (req.session && req.session.user) {
        var user = req.session.user;
        if (!checkLogin(user.username, user.password)) {
            response = {
                "message": "You are not currently logged in"
            };

            req.session.reset();
            res.send(response);
            return;
        }

        if (user.isAdmin === 0) {
            response = {
                "message": "You must be an admin to perform this action"
            };

            res.send(response);
            return;
        }

        var conditions = {};

        if (typeof request.fname !== 'undefined') {
            conditions["fname"] = {$regex: '.*' + request.fname + '.*', $options: 'i'};
        }

        if (typeof request.lname !== 'undefined') {
            conditions["lname"] = {$regex: '.*' + request.lname + '.*', $options: 'i'};
        }

        var query = User.find(conditions);

        query.exec(function (err, result) {
            if (err) console.log(err.message);
            if (result.length === 0) {
                response = {
                    "message": "There are no users that match that criteria"
                };
            } else {
                var jsonArray = [];
                for (var i = 0; i < result.length; i++) {
                    var row = result[i];
                    jsonArray.push({"fname": row.fname, "lname": row.lname, "userId": row.username});
                }
                response = {
                    "message": "The action was successful",
                    "user": jsonArray
                };
            }

            res.send(response);
        });
    }

    else {
        response = {
            "message": "You are not currently logged in"
        };
        req.session.reset();
        res.send(response);
    }
});

app.post('/viewProducts', function (req, res) {
    var request = req.body;
    var asin = request.asin;
    var keyword = request.keyword;
    var groupCategory = request.group;
    var response;

    var conditions = {};

    if (typeof request.asin !== 'undefined') {
        conditions["asin"] = request.asin;
    }

    var isKeywordPresent = false;

    if (typeof request.keyword !== 'undefined') {
        isKeywordPresent = true;

    }

    if (typeof request.group !== 'undefined') {
        conditions["groupCategory"] = groupCategory;
    }

    var query;

    if (isKeywordPresent) {
        query = Product.find(conditions).or([{productName: {$regex: '.*' + keyword + '.*', $options: 'i'}},
            {productDescription: {$regex: '.*' + keyword + '.*', $options: 'i'}}]);

    } else {
        query = Product.find(conditions);
    }

    query.exec(function (err, result) {
        if (err) console.log(err.message);
        if (result.length === 0) {
            response = {
                "message": "There are no products that match that criteria"
            };
        }
        else {
            var jsonArray = [];
            for (var i = 0; i < result.length; i++) {
                var row = result[i];
                jsonArray.push({"asin": row.asin, "productName": row.productName});
            }
            response = {
                "product": jsonArray
            };
        }
        res.send(response);
        console.log(result);
    });
});

function sendMissingFieldMessage(req, res) {
    var response;
    response = {
        "message": "The input you provided is not valid"
    };
    res.send(response);
    return;
}


function checkLogin(username, password) {
    var query = User.find({
        username: username,
        password: password
    });

    query.exec(function (err, result) {
        if (err) throw err;
        if (result.length === 0) {
            return false;
        }
    });

    return true;
}

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
