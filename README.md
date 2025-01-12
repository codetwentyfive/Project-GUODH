# Project-GUODH
HELP THEM OLD PEOPLE NOT BE LONELY AND MAKE THAT MULA ,NO ONE THINKS ABOUT THE OLD PEOPLE ,ITS ALWAYS THE CHILDREN!

# Basic Terminology
What is SIP? 
Session Initiation Protocol (SIP) is a signaling protocol that manages and establishes communication sessions between IP devices. SIP is used for a variety of applications, including: Voice calls, Video conferences, Instant messaging, and Mobile phone calling over LTE (VoLTE). 

# Getting Started

Video Series on asterisk basics:
https://www.youtube.com/watch?v=dyfaFu2yn78

Where to download: 
https://www.asterisk.org/downloads/asterisk/all-asterisk-versions/
Currently we will be targeting the LTS 20.X version

After downloading (If on linux) use `tar zxvf <package name>.tar.gz` to unpack package. 

Once you have unpacked project cd into project and run `./configure` (Make sure to have installed above dependencies before this point)

## Initial Install:
All of these steps except the first assume you are in the base directory of the project.

1. To install dependencies: `sudo apt install libedit-dev uuid-dev libjansson-dev libxml2-dev sqlite3 libsqlite3-dev`
2. `make` will compile the project 
    2a. `make menuconfig` Will configure which packages you want to add(Not necessary yet, we are happy with default for now)
3. `make install` will install the project to use
4. Configuration files are stored in /etc/asterisk. To get config files created for you to start use `make samples` this will give you some files to play with/so that things work.
5. `sudo asterisk -cvvv` will start asterisk in (c)onsole mode and 3 levels of (v)erbose
6. To create your start script:
    6a. `cd contrib/init.d/`
    6b. `cp rc.debian.asterisk /etc/init.d/asterisk` use appropriate architecture in aboves folder if not running debian linux
    To start project: (Won't work till we have other configuration)
    6c. `type asterisk` copy the location this command gives you
    6d. `cd` to get you to root then open file e.g. `sudo vi /etc/init.d/asterisk` (These steps might be easier to follow with (video)[https://www.youtube.com/watch?v=F7eUh3vII7U])
        VIM notes: Use the 'x' key to delete character under cursor. Click 'i' to begin inserting. 'Esc' to stop inserting. Use `:qa!` to cancel without saving and `:!wq` to cancel and save
        6d1. Scroll down to DAEMON replace "__ASTERISK_SBIN_DIR__/asterisk" with the output from `type asterisk` above.
        6d2. For ASTVARRUNDIR write "/var/run/asterisk" (Without quotation marks) after the "="
        6d3. For ASTETCDIR write "/etc/asterisk"

7. From root (Do `cd` if not there) `sudo /etc/init.d/asterisk start` to start the asterisk service in the background. You can now connect to your instance running in the background using `sudo asterisk -r`. Use `exit` to exit instance.
