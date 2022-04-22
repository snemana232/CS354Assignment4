import { Camera } from "../lib/webglutils/Camera.js";
import { Vec3, Vec4, Quat } from "../lib/TSM.js";
export var Mode;
(function (Mode) {
    Mode[Mode["playback"] = 0] = "playback";
    Mode[Mode["edit"] = 1] = "edit";
})(Mode || (Mode = {}));
/**
 * Handles Mouse and Button events along with
 * the the camera.
 */
export class GUI {
    /**
     *
     * @param canvas required to get the width and height of the canvas
     * @param animation required as a back pointer for some of the controls
     * @param sponge required for some of the controls
     */
    constructor(canvas, animation) {
        this.hoverX = 0;
        this.hoverY = 0;
        this.height = canvas.height;
        this.viewPortHeight = this.height - 200;
        this.width = canvas.width;
        this.prevX = 0;
        this.prevY = 0;
        this.animation = animation;
        this.reset();
        this.registerEventListeners(canvas);
    }
    getNumKeyFrames() {
        // TODO
        // Used in the status bar in the GUI
        return 0;
    }
    getTime() { return this.time; }
    getMaxTime() {
        // TODO
        // The animation should stop after the last keyframe
        return 0;
    }
    /**
     * Resets the state of the GUI
     */
    reset() {
        this.fps = false;
        this.dragging = false;
        this.time = 0;
        this.mode = Mode.edit;
        this.camera = new Camera(new Vec3([0, 0, -6]), new Vec3([0, 0, 0]), new Vec3([0, 1, 0]), 45, this.width / this.viewPortHeight, 0.1, 1000.0);
    }
    /**
     * Sets the GUI's camera to the given camera
     * @param cam a new camera
     */
    setCamera(pos, target, upDir, fov, aspect, zNear, zFar) {
        this.camera = new Camera(pos, target, upDir, fov, aspect, zNear, zFar);
    }
    /**
     * Returns the view matrix of the camera
     */
    viewMatrix() {
        return this.camera.viewMatrix();
    }
    /**
     * Returns the projection matrix of the camera
     */
    projMatrix() {
        return this.camera.projMatrix();
    }
    /**
     * Callback function for the start of a drag event.
     * @param mouse
     */
    dragStart(mouse) {
        if (mouse.offsetY > 600) {
            // outside the main panel
            return;
        }
        // TODO
        // Some logic to rotate the bones, instead of moving the camera, if there is a currently highlighted bone
        this.dragging = true;
        this.prevX = mouse.screenX;
        this.prevY = mouse.screenY;
    }
    incrementTime(dT) {
        if (this.mode === Mode.playback) {
            this.time += dT;
            if (this.time >= this.getMaxTime()) {
                this.time = 0;
                this.mode = Mode.edit;
            }
        }
    }
    /**
    
     * The callback function for a drag event.
     * This event happens after dragStart and
     * before dragEnd.
     * @param mouse
     */
    drag(mouse) {
        let x = mouse.offsetX;
        let y = mouse.offsetY;
        if (this.dragging) {
            const dx = mouse.screenX - this.prevX;
            const dy = mouse.screenY - this.prevY;
            this.prevX = mouse.screenX;
            this.prevY = mouse.screenY;
            /* Left button, or primary button */
            const mouseDir = this.camera.right();
            mouseDir.scale(-dx);
            mouseDir.add(this.camera.up().scale(dy));
            mouseDir.normalize();
            if (dx === 0 && dy === 0) {
                return;
            }
            switch (mouse.buttons) {
                case 1: {
                    let rotAxis = Vec3.cross(this.camera.forward(), mouseDir);
                    rotAxis = rotAxis.normalize();
                    if (this.fps) {
                        this.camera.rotate(rotAxis, GUI.rotationSpeed);
                    }
                    else {
                        this.camera.orbitTarget(rotAxis, GUI.rotationSpeed);
                    }
                    //left click
                    if (this.highlight != -1) {
                        let curr = this.animation.getScene().meshes[0].bones[this.highlight];
                        this.rotate(curr, rotAxis);
                    }
                    break;
                }
                case 2: {
                    /* Right button, or secondary button */
                    this.camera.offsetDist(Math.sign(mouseDir.y) * GUI.zoomSpeed);
                    break;
                }
                default: {
                    break;
                }
            }
        }
        // TODO
        // You will want logic here:
        // 1) To highlight a bone, if the mouse is hovering over a bone;
        // 2) To rotate a bone, if the mouse button is pressed and currently highlighting a bone.
        let p = this.camera.pos();
        let q = this.screenToWorld(mouse.offsetX, mouse.offsetY);
        console.log("Camera: [" + p.x + ", " + p.y + ", " + p.z + "]");
        console.log("Bone 0: [" + this.animation.getScene().meshes[0].bones[0].endpoint.x + ", " + this.animation.getScene().meshes[0].bones[0].endpoint.y + ", " + this.animation.getScene().meshes[0].bones[0].endpoint.z + "]");
        console.log("World space Coordinates [: " + q.x + ", " + q.y + ", " + q.z + "]");
        const j_vec = new Vec3([0, 1, 0]);
        // Transform the ray into the cylinder's coordinates. Use the bone's orientation to do this.
        let found = false;
        for (let i = 0; i < this.animation.getScene().meshes[0].bones.length && !found; i++) {
            let bone = this.animation.getScene().meshes[0].bones[i];
            const y_max = Vec3.difference(bone.endpoint, bone.position).length();
            let p_Trans = Vec3.difference(p, bone.position);
            let q_Trans = Vec3.difference(q, bone.position);
            const tang = Vec3.difference(bone.endpoint, bone.position).normalize();
            //column major
            // let Identity: Mat3 = new Mat3([1, 0, 0, 0, 1, 0, 0, 0, 1]);
            // let skew_symmetric: Mat3 = new Mat3([0, v.z, -1*v.y, -1*v.z, 0, v.x, v.y, -1*v.x, 0]);
            // let skew_symmetric_product = Mat3.product(skew_symmetric, skew_symmetric);
            // skew_symmetric_product.scale(new Vec3([1/(1 + co), 1/(1 + co), 1/(1 + co)]));
            // let values: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
            // for (let r = 0; r < 9; r++) {
            //   values[r] = Identity.all()[r] + skew_symmetric.all()[r] + skew_symmetric_product.all()[r];
            // }
            let rot = Quat.fromAxisAngle(Vec3.cross(tang, j_vec), Math.acos(Vec3.dot(tang, j_vec)));
            //console.log("skew_symmetric: " + skew_symmetric.all().toString());
            // console.log("skew_symmetric_product " + skew_symmetric_product.all().toString());
            //console.log("Rotation: ")
            //console.log(", " + Rotation.all()[0] + ", " + Rotation.all()[1] + ", " + Rotation.all()[2] + ", " + Rotation.all()[3] + ", " + Rotation.all()[4] + ", " + Rotation.all()[5]    );
            let p_Cyl = rot.multiplyVec3(p_Trans);
            let q_Cyl = rot.multiplyVec3(q_Trans);
            let d = Vec3.difference(q_Cyl, p_Cyl).normalize();
            //console.log("pCyl: [" + p_Cyl.x +", " + p_Cyl.y + ", " + p_Cyl.z + "]");
            let a = Math.pow(d.x, 2) + Math.pow(d.z, 2);
            let b = 2 * p_Cyl.x * d.x + 2 * p_Cyl.z * d.z;
            let c = Math.pow(p_Cyl.x, 2) + Math.pow(p_Cyl.z, 2) - 1;
            //Solve for t;
            //let t: number = -1*b + Math.sqrt()  
            //console.log("roots? " + (Math.pow(b, 2) - 4*a*c < 0));
            if ((Math.pow(b, 2) - 4 * a * c) < 0) {
                this.highlight = -1;
            }
            else {
                let t1 = ((-1 * b) + Math.sqrt(Math.pow(b, 2) - 4 * a * c)) / (2 * a);
                let t2 = ((-1 * b) - Math.sqrt(Math.pow(b, 2) - 4 * a * c)) / (2 * a);
                //console.log("determinant " + (Math.pow(b, 2) - 4*a*c));
                //console.log("t1:  " + t1 + ", t2: " + t2);
                console.log("t1: " + t1 + ", t2: " + t2);
                let eval1 = new Vec3([p_Cyl.x + d.x * t1, p_Cyl.y + d.y * t1, p_Cyl.z + d.z * t1]);
                let eval2 = new Vec3([p_Cyl.x + d.x * t2, p_Cyl.y + d.y * t2, p_Cyl.z + d.z * t2]);
                // console.log("x: " + eval1.x + ",y: " + eval1.y, ",z: " + eval1.z);
                // console.log("x: " + eval2.x + ",y: " + eval2.y, ",z: " + eval2.z); 
                if ((eval1.y >= 0 && eval1.y < y_max) || (eval2.y >= 0 && eval2.y < y_max)) {
                    console.log("intersection at bone: " + i);
                    this.highlight = i;
                    found = true;
                }
                else {
                    this.highlight = -1;
                }
            }
        }
    }
    rotate(parent, mouseDir) {
        let Bones = this.animation.getScene().meshes[0].bones;
        if (parent.children.length == 0) {
            //Rotate only rotation and endpoint to match parents
            let rotationQuat = Quat.fromAxisAngle(mouseDir, GUI.rotationSpeed);
            let newRotation = new Quat();
            parent.endpoint.multiplyByQuat(rotationQuat);
            rotationQuat.multiply(parent.rotation, newRotation);
            parent.rotation = newRotation;
        }
        for (let i = 0; i < parent.children.length; i++) {
            let rotationQuat = Quat.fromAxisAngle(mouseDir, GUI.rotationSpeed);
            let newRotation = new Quat();
            parent.endpoint.multiplyByQuat(rotationQuat);
            rotationQuat.multiply(parent.rotation);
            parent.rotation = newRotation;
            //convert mouse dir into world space.
            this.rotate(this.animation.getScene().meshes[0].bones[parent.children[i]], mouseDir);
            //start: convert the drag direction into a vector in world coordinates.
            //rotate
        }
    }
    screenToWorld(mouseX, mouseY) {
        // mouseX = mouseX - 10;
        // mouseY = mouseY - 80;
        let ndc_x = ((2.0 * mouseX) / this.width) - 1.0;
        let ndc_y = 1.0 - ((2.0 * mouseY) / this.viewPortHeight);
        let ndc_z = 1.0;
        // console.log("x: " + mouseX + ",y: " + mouseY);
        // console.log("width: " + this.width  + ", height: " + this.viewPortHeight);
        console.log("ndc_x: " + ndc_x + ", ndc_y: " + ndc_y);
        let ndc_coords = new Vec4([ndc_x, ndc_y, ndc_z, 1.0]);
        let camera_coords = this.camera.projMatrix().inverse().multiplyVec4(ndc_coords);
        camera_coords = new Vec4([camera_coords.x, camera_coords.y, -1.0, 0.0]);
        let world_coords = this.camera.viewMatrix().inverse().multiplyVec4(camera_coords);
        //let result: Vec3  = new Vec3 ([world_coords.x/world_coords.w, world_coords.y/world_coords.w, world_coords.z/world_coords.w]);
        //return Vec3.difference(this.camera.pos(), new Vec3(world_coords.xyz));
        return new Vec3(world_coords.xyz).normalize();
    }
    getModeString() {
        switch (this.mode) {
            case Mode.edit: {
                return "edit: " + this.getNumKeyFrames() + " keyframes";
            }
            case Mode.playback: {
                return "playback: " + this.getTime().toFixed(2) + " / " + this.getMaxTime().toFixed(2);
            }
        }
    }
    /**
     * Callback function for the end of a drag event
     * @param mouse
     */
    dragEnd(mouse) {
        this.dragging = false;
        this.prevX = 0;
        this.prevY = 0;
        // TODO
        // Maybe your bone highlight/dragging logic needs to do stuff here too
    }
    /**
     * Callback function for a key press event
     * @param key
     */
    onKeydown(key) {
        switch (key.code) {
            case "Digit1": {
                this.animation.setScene("/static/assets/skinning/split_cube.dae");
                break;
            }
            case "Digit2": {
                this.animation.setScene("/static/assets/skinning/long_cubes.dae");
                break;
            }
            case "Digit3": {
                this.animation.setScene("/static/assets/skinning/simple_art.dae");
                break;
            }
            case "Digit4": {
                this.animation.setScene("/static/assets/skinning/mapped_cube.dae");
                break;
            }
            case "Digit5": {
                this.animation.setScene("/static/assets/skinning/robot.dae");
                break;
            }
            case "Digit6": {
                this.animation.setScene("/static/assets/skinning/head.dae");
                break;
            }
            case "Digit7": {
                this.animation.setScene("/static/assets/skinning/wolf.dae");
                break;
            }
            case "KeyW": {
                this.camera.offset(this.camera.forward().negate(), GUI.zoomSpeed, true);
                break;
            }
            case "KeyA": {
                this.camera.offset(this.camera.right().negate(), GUI.zoomSpeed, true);
                break;
            }
            case "KeyS": {
                this.camera.offset(this.camera.forward(), GUI.zoomSpeed, true);
                break;
            }
            case "KeyD": {
                this.camera.offset(this.camera.right(), GUI.zoomSpeed, true);
                break;
            }
            case "KeyR": {
                this.animation.reset();
                break;
            }
            case "ArrowLeft": {
                this.camera.roll(GUI.rollSpeed, false);
                break;
            }
            case "ArrowRight": {
                this.camera.roll(GUI.rollSpeed, true);
                break;
            }
            case "ArrowUp": {
                this.camera.offset(this.camera.up(), GUI.zoomSpeed, true);
                break;
            }
            case "ArrowDown": {
                this.camera.offset(this.camera.up().negate(), GUI.zoomSpeed, true);
                break;
            }
            case "KeyK": {
                if (this.mode === Mode.edit) {
                    // TODO
                    // Add keyframe
                }
                break;
            }
            case "KeyP": {
                if (this.mode === Mode.edit && this.getNumKeyFrames() > 1) {
                    this.mode = Mode.playback;
                    this.time = 0;
                }
                else if (this.mode === Mode.playback) {
                    this.mode = Mode.edit;
                }
                break;
            }
            default: {
                console.log("Key : '", key.code, "' was pressed.");
                break;
            }
        }
    }
    /**
     * Registers all event listeners for the GUI
     * @param canvas The canvas being used
     */
    registerEventListeners(canvas) {
        /* Event listener for key controls */
        window.addEventListener("keydown", (key) => this.onKeydown(key));
        /* Event listener for mouse controls */
        canvas.addEventListener("mousedown", (mouse) => this.dragStart(mouse));
        canvas.addEventListener("mousemove", (mouse) => this.drag(mouse));
        canvas.addEventListener("mouseup", (mouse) => this.dragEnd(mouse));
        /* Event listener to stop the right click menu */
        canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    }
}
GUI.rotationSpeed = 0.05;
GUI.zoomSpeed = 0.1;
GUI.rollSpeed = 0.1;
GUI.panSpeed = 0.1;
//# sourceMappingURL=Gui.js.map