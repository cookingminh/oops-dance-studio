import { FaPhoneVolume } from 'react-icons/fa6';
import { MdOutlineMail } from 'react-icons/md';
import { FaFacebookSquare } from 'react-icons/fa';
import { Modal, ModalHeader, ModalBody, ModalContent } from '@nextui-org/react';

const ContactModal = ({ isOpen, onOpenChange }) => (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
            <ModalHeader className="flex justify-center">
                <div id="modal-title" style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    Contact Us
                </div>
            </ModalHeader>
            <ModalBody className="text-center">
                <div className="flex gap-3">
                    <FaPhoneVolume className="icon" />
                    <p>Hotline: <a href="tel:0796180646">079 618 0646</a></p>
                </div>
                <div className="flex gap-3">
                    <MdOutlineMail className="icon" />
                    <p>Email us: <a href="mailto:oopsdancestudio@gmail.com">oopsdancestudio@gmail.com</a></p>
                </div>
                <div className="flex gap-3">
                    <FaFacebookSquare className="icon" />
                    <p>
                        Our fanpage:{' '}
                        <a href="https://www.facebook.com/oopsdancestudio" target="_blank" rel="noopener noreferrer" className="font-semibold">
                            Oops! Dance Studio
                        </a>
                    </p>
                </div>
            </ModalBody>
        </ModalContent>
    </Modal>
);

export default ContactModal;
