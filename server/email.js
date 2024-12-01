'use strict';

import nodemailer from 'nodemailer';

export default class Email {
  constructor() {
    // this.transporter = nodemailer.createTransport({
    //     service: 'yandex',
    //     auth: {
    //         user: 'nedol@yandex.ru', //"admin@delivery-angels.ru",//
    //         pass: 'Nissan@386'
    //     }
    // })
    // this.transporter = nodemailer.createTransport({
    //     service: 'gmail',
    //     auth: {
    //         user: 'nedol.d2d@gmail.com', //"admin@delivery-angels.ru",//
    //         pass: 'Nissan_386'
    //     }
    // })
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      port: 465,
      secure: true, // upgrade later with STARTTLS
      auth: {
        user:'kolmit.be@gmail.com',
        pass:'zsfz xbhd iwax jvxj'
      },
    });
  }

  SendMail(from, to, subj, html, cb) {
    let mailOptions = {
      from: from, //from, //'youremail@gmail.com',
      to: to, //'myfriend@yahoo.com',
      subject: subj,
      html: html,
    };
    this.transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        cb({ err: error });
        console.log(error);
      } else {
        cb('Email sent: ' + info.response);
        console.log('Email sent to: ' + info.accepted[0]);
      }
    });
  }
}
