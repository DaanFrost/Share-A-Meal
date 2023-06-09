const logger = require('../util/utils').logger;
const assert = require('assert');
const pool = require('../util/mysql-db');
const jwt = require('jsonwebtoken');


const userController = {
    getUsers: function (req, res, next) {
        console.log("Executing getUsers function");
        const filter = req.query.fakeFilter; 
        const isActive = req.query.isActive;
        const password = req.query.password;

        pool.getConnection(function (err, conn) {
            if (err) {
                console.log("Error");
                next({
                    status: 500,
                    message: 'Internal Server Error'
                });
                return;
            }

            if (conn) {
                let query = 'SELECT * FROM user';

                if (isActive !== undefined) {
                    if (isActive === 'true') {
                        query += ' WHERE isActive = 1';
                    } else if (isActive === 'false') {
                        query += ' WHERE isActive = 0';
                    }
                }

                if (filter && filter !== 'fake') {
                    query += ` AND columnName = '${filter}'`; 
                }

                if (password === 'secret') {
                    query += ` AND password = 'secret'`;
                }

                conn.query(query, function (err, results, fields) {
                    if (err) {
                        next({
                            status: 409,
                            message: err.message
                        });
                        return;
                    }

                    if (results.length === 0) {
                        const responseData = {
                            status: 200,
                            message: 'No users found with the specified filter.',
                            data: []
                        };

                        res.status(200).json(responseData);
                    } else {
                        const responseData = {
                            status: 200,
                            message: 'User GetAll endpoint',
                            data: results
                        };

                        res.status(200).json(responseData);
                    }

                    conn.release();
                });
            }
        });
    },

    createUser: function (req, res, next) {
        const { firstName, lastName, street, city, isActive, emailAdress, password, phoneNumber } = req.body;
        try {
            assert(typeof firstName === 'string', 'firstName must be a string');
            assert(typeof lastName === 'string', 'lastName must be a string');
            assert(typeof street === 'string', 'street must be a string');
            assert(typeof city === 'string', 'city must be a string');
            assert(typeof emailAdress === 'string', 'emailAdress must be a string');
            assert(typeof password === 'string', 'password must be a string');
            assert(typeof phoneNumber === 'string', 'phoneNumber must be a string');

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            assert(emailRegex.test(emailAdress), 'Email adress is not valid');

            const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
            assert(passwordRegex.test(password), 'Password is not valid');

            pool.getConnection(function (err, conn) {
                if (err) {
                    console.log("Error: Failed to establish a database connection");
                    next({
                        status: 500,
                        message: "Internal Server Error"
                    });
                }

                if (conn) {

                    const queryCreate = 'INSERT INTO user (firstName, lastName, street, city, isActive, emailAdress, password, phoneNumber) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
                    conn.query(queryCreate, [firstName, lastName, street, city, isActive, emailAdress, password, phoneNumber], function (err, results, fields) {
                        if (err) {
                            if (err.code === 'ER_DUP_ENTRY') {
                                console.log("Error: Duplicate entry");

                                res.status(403).json({
                                    status: 403,
                                    message: "User already exists.",
                                    data: {
                                    }

                                })

                            } else {
                                console.log("Error: Failed to execute insert query", err);
                                next({
                                    status: 500,
                                    message: "Internal Server Error"
                                });
                            }
                        } else {
                            const newUserId = results.insertId;
                            console.log("User created successfully");
                            res.status(201).json({
                                status: 201,
                                message: `User with ID ${newUserId} has been added`,
                                data: {
                                    id: newUserId,
                                    firstName,
                                    lastName,
                                    street,
                                    city,
                                    isActive,
                                    emailAdress,
                                    password,
                                    phoneNumber
                                }
                            });
                        }
                        pool.releaseConnection(conn);
                    });
                }
            });
        } catch (err) {
            console.log("Error: Validation failed", err);
            res.status(400).json({
                status: 400,
                message: err.toString(),
                data: {},
            });
        }
    },

    getUserProfile: function (req, res, next) {
        const userId = req.userId
        console.log("UserID: " + req.userId)
        logger.trace('Get user profile for user', req.userId);

        let sqlStatement = 'SELECT * FROM `user` WHERE id=?';

        console.log('UserID:', userId);
        pool.getConnection(function (err, conn) {
            if (err) {
                logger.error(err.code, err.syscall, err.address, err.port);
                next({
                    status: 500,
                    message: err.code
                });
            }
            if (conn) {
                conn.query(sqlStatement, [userId], (err, results, fields) => {
                    if (err) {
                        logger.error(err.message);
                        next({
                            status: 409,
                            message: err.message
                        });
                    }
                    if (results) {
                        logger.trace('Found', results.length, 'results');
                        res.status(200).json({
                            status: 200,
                            message: 'Get User profile',
                            data: results[0]
                        });
                    }
                });
                pool.releaseConnection(conn);
            }
        });
    },

    getUserWithId: function (req, res, next) {
        const userId = req.params.userId;

        try {
            pool.getConnection(function (err, conn) {
                if (err) {
                    console.log("Error: Failed to establish a database connection");
                    next({
                        status: 500,
                        message: "Internal Server Error"
                    });
                }

                if (conn) {
                    pool.query('SELECT * FROM user WHERE id = ?', [userId], (err, results) => {
                        if (err) {
                            console.log("Error retrieving user");
                            next({
                                status: 500,
                                message: "Internal Server Error"
                            });
                        } else if (results.length === 0) {
                            console.log("User not found");
                            res.status(404).json({
                                status: 404,
                                message: `User met ID ${userId} niet gevonden`,
                                data: {},
                            });
                        } else {
                            const user = results[0];

                            res.status(200).json({
                                status: 200,
                                message: `User met ID ${userId} is gevonden`,
                                data: user,
                            });
                        } pool.releaseConnection(conn);
                    });
                }
            });
        } catch (err) {
            res.status(400).json({
                status: 400,
                message: err.toString(),
                data: {},
            })
        }
    },

    userUpdate: function (req, res, next) {
        const { userId } = req.params;

        if (userId != req.userId) {
            res.status(403).json({
                status: 403,
                message: "User is not the owner of this data",
                data: {}
            })
        }

        const { firstName, lastName, street, city, isActive, emailAdress, password, phoneNumber } = req.body;
        try {
            assert(typeof firstName === 'undefined' || typeof firstName === 'string', 'firstName must be a string');
            assert(typeof lastName === 'undefined' || typeof lastName === 'string', 'lastName must be a string');
            assert(typeof street === 'undefined' || typeof street === 'string', 'street must be a string');
            assert(typeof city === 'undefined' || typeof city === 'string', 'city must be a string');
            assert(typeof emailAdress === 'undefined' || typeof emailAdress === 'string', 'emailAdress must be a string');
            assert(typeof password === 'undefined' || typeof password === 'string', 'password must be a string');
            assert(typeof phoneNumber === 'undefined' || typeof phoneNumber === 'string', 'phoneNumber must be a string');

            const phoneRegex = /^06[-\s]?\d{8}$/;
            assert(phoneRegex.test(phoneNumber), 'Phone number is not valid');

            pool.getConnection(function (err, conn) {
                if (err) {
                    console.log("Error: Failed to establish a database connection");
                    console.log(err);
                    res.status(500).json({
                        status: 500,
                        message: "Failed to establish a database connection",
                        data: { error: err }
                    })
                }

                if (conn) {
                    pool.query('SELECT * FROM user WHERE id = ?', [userId], (err, results) => {
                        if (err) {
                            console.log("Error retrieving user");
                            res.status(500).json({
                                status: 500,
                                message: "Error retrieving user",
                                data: { error: err }
                            })


                        } else if (results.affectedRows === 0) {
                            console.log("User not found");
                            return res.status(404).json({
                                status: 404,
                                message: `User with ID ${userId} not found`,
                                data: {},
                            });

                        } else if (results.length === 1) {
                            const user = results[0];
                            user.firstName = firstName || user.firstName;
                            user.lastName = lastName || user.lastName;
                            user.street = street || user.street;
                            user.city = city || user.city;
                            user.isActive = isActive || user.isActive;
                            user.emailAdress = emailAdress || user.emailAdress;
                            user.phoneNumber = phoneNumber || user.phoneNumber;

                            const query = 'UPDATE user SET firstName = ?, lastName = ?, street = ?, city = ?, isActive = ?, emailAdress = ?, password = ?, phoneNumber = ? WHERE id = ?';
                            conn.query(query, [user.firstName, user.lastName, user.street, user.city, user.isActive, user.emailAdress, password, user.phoneNumber, userId], function (err, results, fields) {
                                console.log('Executing update query');
                                if (err) {
                                    console.log("Error updating user:", err);
                                    next({
                                        status: 500,
                                        message: "Internal Server Error"
                                    });
                                } else {
                                    console.log("User updated successfully");
                                    res.status(200).json({
                                        status: 200,
                                        message: "User updated successfully",
                                        data: user,
                                    });
                                }
                                pool.releaseConnection(conn);
                            });
                        }
                    });
                }
            });
        } catch (err) {
            res.status(400).json({
                status: 400,
                message: err.toString(),
                data: {},
            });
        }
    },

    userDelete: function (req, res, next) {
        const { userId } = req.params;

        if (userId != req.userId) {
            return res.status(403).json({
                status: 403,
                message: "User is not the owner of this data",
                data: {}
            });
        }

        pool.getConnection(function (err, conn) {
            if (err) {
                console.log("Error: Failed to establish a database connection");
                return next({
                    status: 500,
                    message: "Can't connect"
                });
            }

            pool.query('SELECT * FROM user WHERE id = ?', [userId], (err, results) => {
                if (err) {
                    console.log("Error retrieving user", err);
                    return next({
                        status: 500,
                        message: "Can't query select"
                    });
                }

                if (results.length === 0) {
                    console.log("User not found");
                    return res.status(404).json({
                        status: 404,
                        message: `User met ID ${userId} niet gevonden`,
                        data: {},
                    });
                }

                conn.query('DELETE FROM user WHERE id = ?', [userId], (err) => {
                    if (err) {
                        console.log("Error deleting user", err);
                        return next({
                            status: 500,
                            message: "Can't query delete"
                        });
                    }

                    res.status(200).json({
                        status: 200,
                        message: "User deleted successfully",
                        data: {},
                    });

                    pool.releaseConnection(conn);
                });
            });
        });
    },
};

module.exports = userController